可以先阅读[这篇文章](./tapable%E7%B2%BE%E8%AE%B2.md)

### tapable
webpack插件机制的核心。小而美又强的一个库。核心原理也是依赖于发布订阅模式。在开始前可以思考一下以下几个问题：
- 一道高频面试题：loader和plugin的区别(可以从概念，执行时机，源码层面区分)。如何实现loader，如何实现plugin。
- new Function是做什么。let argNames=[“a”,"b",“c”]，new Function(argNames.join(“,”),"函数体")
- [单态性及多态性概念](https://mrale.ph/blog/2015/01/11/whats-up-with-monomorphism.html)
- 下面哪种函数执行效率更高?哪种函数更易拓展
- 发布订阅模式是什么?如何实现一个简单的事件监听，触发及取消。
- tapable的用法精讲及设计思想
- 当注册的插件以及调用call的次数达到十万甚至百万级别的时候，tapable是如何做性能优化的
- 如何实现一个 `异步串行钩子`，比如下面的例子，实现一个callAsync方法，一次执行完this.tasks里面的任务，一个任务执行完成才能继续执行下一个。
当所有的任务执行完成，那么执行callAsync方法中最终的回调函数(callAsync的最后一个参数即是最终的回调函数)
```javascript
class AsyncSeriesHook{
  constructor(){
    this.tasks = []
  }
  tapAsync(task){
    this.tasks.push(task)
  }
  callAsync(...args){}
}

const testhook = new AsyncSeriesHook()

testhook.tapAsync((name, compilation, cb) => {
  setTimeout(() => {
    compilation.sum = compilation.sum + 1
    cb() //  调用cb()才能执行下一个回调
  }, 2000)
})

testhook.tapAsync((name, compilation, cb) => {
  console.log( compilation, name)
  setTimeout(() => {
    compilation.sum = compilation.sum + 2
    cb() //  调用cb()才能执行下一个回调
  }, 3000)
})
const compilation = { sum: 0 }

testhook.callAsync('Mike', compilation, function(){
  console.log('所有插件执行完成', compilation)
})
```

### tapable基础部分
所有的钩子构造函数接收一个数组参数，这个数组是注册的回调的参数名称。使用`tap`方法注册插件

```javascript
const { SyncHook } = require('tapable')

const hook = new SyncHook(['name', 'age', 'address'])

hook.tap('plugin1', (name, age, address) => {
  console.log('plugin1', name, age, address)
  const start = new Date().getTime()
  while(new Date().getTime() - start < 2000) {}
})

hook.tap('plugin2', (name, age, address) => {
  console.log('plugin2', name, age, address)
})


// 拦截器
hook.intercept({
  // 调用hook.call方法时，会先执行下面的call方法，然后执行注册的插件回调
  call: (name, age, address) => {
    console.log("调用hook.call方法时执行，接收的参数是hook.call的参数", name, age, address);
  },
  // 会在每个插件执行前执行下面的tap方法。比如在执行plugin1的回调前，会先执行下面的tap方法
  tap: (tapInfo) => {
    const { type, name, fn } = tapInfo
    console.log(`tap:${tapInfo.name} is doing its job`);
  },
  // 调用hook.tap方法注册插件时，就会执行register方法，register方法可以修改插件的行为
  register: (tapInfo) => {
    const { type, name, fn } = tapInfo
    console.log(`${tapInfo.name} is doing its job`);
    if(tapInfo.name === 'plugin2'){
      return {
        ...tapInfo,
        fn: (name, age, address) => {
          console.log('拦截plugin2的回调函数逻辑，在执行真正的plugin2回调前先执行拦截的逻辑')
          fn(name, age, address);
        }
      }
    }
    return tapInfo
  }
})

hook.call('mike', 26, 'china')
```

#### tapable注册插件的方法
- 注册同步插件：tap
- 注册异步插件：
    + tapAsync(cb)
    + tapPromise，返回的是promise
    
只能通过以上三个方法注册插件，除此之外别无他法。这三个方法都接收两个参数，第一个是自定义的插件名称，第二个是插件的回调函数。插件名称
是自定义的，用来识别是哪个插件。一般情况下很少用到这个名称。但是如果需要使用tapable拦截器，这个名称还是很有用的。就像上例中的
register拦截器。

#### tapable触发插件执行的方法
- 同步调用：call
- 异步调用：
    + callAsync
    + promise
    
只能通过以上三个方法触发插件执行，除此之外别无他法。当调用以上方法时，会触发通过tap、tapAsync、tapPromise注册的所有插件的
回调函数


#### tapable分类
tapable hook 类型可以分为 `SyncHook(同步钩子)`、`AsyncHook(异步钩子)`，异步又分为 `并行` 和 `串行`。

- 同步钩子，名字以`Sync`开头的，**只能通过hook.tap注册插件**。但是都可以通过hook.call，hook.callAsync以及hook.promise触发插件执行
- Basic。目前Basic类型的Hook只有SyncHook。这种Hook的特点是不关心插件回调函数的返回值，并且串行执行插件回调函数。
- Bail。名字带有Bail的都是保险式Hook，允许中断插件回调函数的执行，只要插件监听函数中有返回值(不为undefined)，则不执行后面的插件回调函数
- Waterfall。名字带有Waterfall的都是瀑布式Hook，串行执行，这种Hook的特点是，上一个插件回调函数的返回值会传递给下一个插件回调函数的参数
- Loop。名字带有Loop的都是循环类型的Hook。这种Hook的特点是，只要插件回调函数返回true，则hook会从第一个插件回调函数开始重新执行，直到所有的插件回调函数都返回undefined


#### HookCodeFactory
tapable在执行插件回调函数时做了一些优化。tapable在运行时动态生成执行插件回调函数的方法，这部分代码在`HookCodeFactory.js`文件中。总之，tapable会根据
以下条件动态生成执行代码：
- 注册的插件回调函数的数量：无，一个，很多
- 注册的插件回调函数的类型：sync，async，promise
- 使用的触发方法：sync，async，promise
- 参数的数量
- 是否使用了拦截器

tapable的说法是，这样能够确保尽可能快的执行。因此可以看到HookCodeFactory.js中使用了大量的字符串拼接方式生成函数执行体。理论依据可以
点击查看：[What's up with monomorphism?](https://mrale.ph/blog/2015/01/11/whats-up-with-monomorphism.html)。

以上面的例子为例。**如果我们细心观察就会发现，plugin1和plugin2的回调函数参数具有单态性。而且这些函数是会依次执行的**。按照js引擎属性查找算法认为
，如果函数的参数形态单一，那么查找效率就会高很多。

思考下面两种实现方法：
```javascript

// 方法一：
const callFn = (...tasks) => (...args) => {
   for (const fn of tasks) {
      fn(...args)
    }
}

// 方法二：
const g = (a, b, c) => (x, y) => {
  a(x, y);
  b(x, y);
  c(x, y);
}

```
如果按照js引擎属性查找算法，那么理论上方法二的执行效率更高。但是需要依赖于固定的函数参数形态。方法一虽然执行效率低下，但是能够兼容不同数量的插件回调函数以及
不同数量的函数参数。

在webpack中，我们会注册大量的插件回调函数，这些函数数量众多且参数数量不限，提高这些回调函数的执行效率对webpack打包效率有重要的影响。
那么问题来了，如何既能使用方法二的方式执行我们注册的插件回调函数，还能兼容数量不限的回调函数及参数。这就是HookCodeFactory做的事情。简单点说就是通过字符串拼接
的方式构造函数执行体，并且使用new Function动态生成函数。

**实际上，我对这种优化方式存疑**

一个简化版的HookCodeFactory核心逻辑如下：
```javascript
class HookCodeFactory {
  constructor(args){
      this._args = args;
      this.tasks = [];
  }

  // createCall动态创建方法，创建的目的，举个例子，加入我们调用new SyncHook(['name', 'age', 'address'])，在初始化hook的时候，
  // 参数个数已经是明确的了，那么我们调用的时候就可以根据单态特征创建一个类似的调用函数：
  // finalCall(name, age, addre){
  //   callback1(name, age, address);
  //   callback2(name, age, address);
  //   callback3(name, age, address);
  //   ....
  //   callbackn(name, age, address);
  // }
  // 其中callback是调用myHook.tap注册的回调函数。在webpack中，这种回调函数数量巨大，而且执行具有单态特征，并且每个
  // callback执行的逻辑不一样
  createCall(){
    let code = '';
    const params = this._args.join(',');
    for(let i = 0; i < this.tasks.length; i++){
      code += `
        var callback${i} = this.tasks[${i}];
        callback${i}(${params})
      `
    }
    return new Function(params, code)
  }
  call(...args){
    const finalCall = this.createCall();
    // console.log(finalCall)
    return finalCall.apply(this, args)
  }
}
```


### tapable 高级部分

#### tapable拦截器
通过hook.intercept可以注册拦截器，比如
```javascript
// 拦截器
hook.intercept({
  // 调用hook.call方法时，会先执行下面的call方法，然后执行注册的插件回调
  call: (name, age, address) => {
    console.log("调用hook.call方法时执行，接收的参数是hook.call的参数", name, age, address);
  },
  // 会在每个插件执行前执行下面的tap方法。比如在执行plugin1的回调前，会先执行下面的tap方法
  tap: (tapInfo) => {
    const { type, name, fn } = tapInfo
    console.log(`tap:${tapInfo.name} is doing its job`);
  },
  // 调用hook.tap方法注册插件时，就会执行register方法，register方法可以修改插件的行为
  register: (tapInfo) => {
    const { type, name, fn } = tapInfo
    console.log(`${tapInfo.name} is doing its job`);
    if(tapInfo.name === 'plugin2'){
      return {
        ...tapInfo,
        fn: (name, age, address) => {
          console.log('拦截plugin2的回调函数逻辑，在执行真正的plugin2回调前先执行拦截的逻辑')
          fn(name, age, address);
        }
      }
    }
    return tapInfo
  }
})
```
- `call`拦截器执行时机是调用hook.call后立即执行call拦截器
- `tap`拦截器的执行时机是，调用hook.call后会依次执行所有的插件回调函数，但是在执行每一个插件回调函数之前，都要调用一次tap拦截器
-  `register`拦截器的执行时机是，当调用hook.tap注册插件时，会立即调用一次register拦截器。register拦截器是唯一的能够改变插件回调
函数行为的拦截器。



#### 各类型hook用法简介
##### SyncHook
插件的返回值没有意义。
- 通过hook.call(...args)触发插件执行，捕获不了插件内部抛出的错误，程序崩溃
- 通过hook.callAsync(...args, err => {})触发插件执行，如果插件内部发生错误，不会继续执行后续的插件，执行最终的回调函数，err接收错误的值
- 通过hook.promise(...args).then(res => {}, err => {})。res不会接收任何值。如果插件内部发生错误，则不会执行后续的插件，直接改变
    hook.promise的状态，err接收插件抛出的错误

用法：
```javascript
const testhook = new SyncHook(['compilation'])
testhook.tap('plugin1', (compilation, name) => {
  console.log('plugin1', name)
  compilation.sum = compilation.sum + 1
  // const start = new Date().getTime();
  // while(new Date().getTime() - start < 5000){}
  // return compilation
})

testhook.tap('plugin2', (compilation, name) => {
  console.log('plugin2..',name)
  compilation.sum = compilation.sum + 2
  throw Error('抛出一个错误')
  return { name: 'plugin2'}; // 返回值没意义
})

testhook.tap('plugin3', (compilation, name) => {
  console.log('plugin3', compilation, name)
  compilation.sum = compilation.sum + 3
  return { test: ''}
})

const compilation = { sum: 0 }
// 第一种触发方式：通过call触发
testhook.call(compilation)

// testhook.call经过HookCodeFactory.js生成后的源码：
function anonymous(compilation) {
  "use strict";
  var _context;
  var _x = this._x;
  var _fn0 = _x[0];
  _fn0(compilation);
  var _fn1 = _x[1];
  _fn1(compilation);
  var _fn2 = _x[2];
  _fn2(compilation);
}

// 第二种触发方式：通过callAsync
testhook.callAsync(compilation, (...args) => {
  console.log('最终回调完成..', ...args)
})

// testhook.callAsync经过HookCodeFactory.js生成后的源码：
function anonymous2(compilation, _callback) {
  "use strict";
  var _context;
  var _x = this._x;
  var _fn0 = _x[0];
  var _hasError0 = false;
  try {
    _fn0(compilation);
  } catch(_err) {
    _hasError0 = true;
    _callback(_err);
  }
  if(!_hasError0) {
    var _fn1 = _x[1];
    var _hasError1 = false;
    try {
      _fn1(compilation);
    } catch(_err) {
      _hasError1 = true;
      _callback(_err);
    }
    if(!_hasError1) {
      var _fn2 = _x[2];
      var _hasError2 = false;
      try {
        _fn2(compilation);
      } catch(_err) {
        _hasError2 = true;
        _callback(_err);
      }
      if(!_hasError2) {
        _callback();
      }
    }
  }
}


// 第三种触发方式：通过promise
testhook.promise(compilation).then(res => {
   console.log('最终回调...',res)
 }, err => {
   console.log('出错了。。。', err)
})
console.log('执行完成', compilation)

//  testhook.promise经过HookCodeFactory.js生成后的源码：
function anonymous3(compilation) {
  "use strict";
  var _context;
  var _x = this._x;
  return new Promise((function(_resolve, _reject) {
    var _sync = true;
    function _error(_err) {
      if(_sync)
        _resolve(Promise.resolve().then((function() { throw _err; }))); // 这里和直接_reject(_err)有什么分别？
      else
        _reject(_err);
    };
    var _fn0 = _x[0];
    var _hasError0 = false;
    try {
      _fn0(compilation);
    } catch(_err) {
      _hasError0 = true;
      _error(_err);
    }
    if(!_hasError0) {
      var _fn1 = _x[1];
      var _hasError1 = false;
      try {
        _fn1(compilation);
      } catch(_err) {
        _hasError1 = true;
        _error(_err);
      }
      if(!_hasError1) {
        var _fn2 = _x[2];
        var _hasError2 = false;
        try {
          _fn2(compilation);
        } catch(_err) {
          _hasError2 = true;
          _error(_err);
        }
        if(!_hasError2) {
          _resolve();
        }
      }
    }
    _sync = false;
  }));
}


```


##### SyncLoopHook
插件的返回值有意义。插件如果有返回非undefined的值，则hook会从第一个插件开始重新执行。如果插件返回undefined，则继续执行下一个插件
- 通过hook.call(...args)触发插件执行，捕获不了插件内部抛出的错误，程序崩溃
- 通过hook.callAsync(...args, err => {})触发插件执行，如果插件内部发生错误，不会继续执行后续的插件，执行最终的回调函数，err接收错误的值
- 通过hook.promise(...args).then(res => {}, err => {})。res不会接收任何值。如果插件内部发生错误，则不会执行后续的插件，直接改变
    hook.promise的状态，err接收插件抛出的错误
    
用法：
```javascript
const testhook = new SyncLoopHook(['compilation'])
let count = 3;
testhook.tap('plugin1', (compilation) => {
  console.log('plugin1', count)
  compilation.sum = compilation.sum + 1
})

testhook.tap('plugin2', (compilation) => {
  console.log('plugin2', count)
  compilation.sum = compilation.sum + 2
  count--;
  throw Error('plugin2 抛出错误')
  if(count < 1) return undefined;
  return null; // 返回了非undefined的值，因此hook执行到这里又会从第一个插件开始重新执行
})

testhook.tap('plugin3', (compilation) => {
  console.log('plugin3')
  compilation.sum = compilation.sum + 3
  return
})

const compilation = { sum: 0 }
// 第一种触发方式：通过call触发
testhook.call(compilation)
// testhook.call经过HookCodeFactory.js生成后的源码：
function anonymous1(compilation) {
  "use strict";
  var _context;
  var _x = this._x;
  var _loop;
  do {
    _loop = false;
    var _fn0 = _x[0];
    var _result0 = _fn0(compilation);
    if(_result0 !== undefined) {
      _loop = true;
    } else {
      var _fn1 = _x[1];
      var _result1 = _fn1(compilation);
      if(_result1 !== undefined) {
        _loop = true;
      } else {
        var _fn2 = _x[2];
        var _result2 = _fn2(compilation);
        if(_result2 !== undefined) {
          _loop = true;
        } else {
          if(!_loop) {
          }
        }
      }
    }
  } while(_loop);
}


// 第二种触发方式：通过callAsync
testhook.callAsync(compilation, (error) => {
   console.log('最终回调完成..', error)
})
// testhook.callAsync经过HookCodeFactory.js生成后的源码：
function anonymous2(compilation, _callback) {
  "use strict";
  var _context;
  var _x = this._x;
  var _loop;
  do {
    _loop = false;
    var _fn0 = _x[0];
    var _hasError0 = false;
    try {
      var _result0 = _fn0(compilation);
    } catch(_err) {
      _hasError0 = true;
      _callback(_err);
    }
    if(!_hasError0) {
      if(_result0 !== undefined) {
        _loop = true;
      } else {
        var _fn1 = _x[1];
        var _hasError1 = false;
        try {
          var _result1 = _fn1(compilation);
        } catch(_err) {
          _hasError1 = true;
          _callback(_err);
        }
        if(!_hasError1) {
          if(_result1 !== undefined) {
            _loop = true;
          } else {
            var _fn2 = _x[2];
            var _hasError2 = false;
            try {
              var _result2 = _fn2(compilation);
            } catch(_err) {
              _hasError2 = true;
              _callback(_err);
            }
            if(!_hasError2) {
              if(_result2 !== undefined) {
                _loop = true;
              } else {
                if(!_loop) {
                  _callback();
                }
              }
            }
          }
        }
      }
    }
  } while(_loop);
}

// 第三种触发方式：通过promise
testhook.promise(compilation).then(res => {
   console.log('最终回调...',res)
}, err => {
   console.log('出错了...', err)
})
console.log('执行完成', compilation)

// testhook.promise经过HookCodeFactory.js生成后的源码：
function anonymous3(compilation) {
  "use strict";
  var _context;
  var _x = this._x;
  return new Promise((function(_resolve, _reject) {
    var _sync = true;
    function _error(_err) {
      if(_sync)
        _resolve(Promise.resolve().then((function() { throw _err; }))); // 存疑？为什么不直接_reject(_err)
      else
        _reject(_err);
    };
    var _loop;
    do {
      _loop = false;
      var _fn0 = _x[0];
      var _hasError0 = false;
      try {
        var _result0 = _fn0(compilation);
      } catch(_err) {
        _hasError0 = true;
        _error(_err);
      }
      if(!_hasError0) {
        if(_result0 !== undefined) {
          _loop = true;
        } else {
          var _fn1 = _x[1];
          var _hasError1 = false;
          try {
            var _result1 = _fn1(compilation);
          } catch(_err) {
            _hasError1 = true;
            _error(_err);
          }
          if(!_hasError1) {
            if(_result1 !== undefined) {
              _loop = true;
            } else {
              var _fn2 = _x[2];
              var _hasError2 = false;
              try {
                var _result2 = _fn2(compilation);
              } catch(_err) {
                _hasError2 = true;
                _error(_err);
              }
              if(!_hasError2) {
                if(_result2 !== undefined) {
                  _loop = true;
                } else {
                  if(!_loop) {
                    _resolve();
                  }
                }
              }
            }
          }
        }
      }
    } while(_loop);
    _sync = false;
  }));
}

```
    
    
    
    
##### SyncBailHook
插件的返回值有意义，如果插件返回了非undefined的值比如result，那么插件提前退出，不会继续执行后续插件。执行最终的回调函数。如果插件返回undefined，则继续执行后续的插件
- 通过hook.call(...args)触发插件执行，捕获不了插件内部抛出的错误，程序崩溃。插件的返回值也接受不到
- 通过hook.callAsync(...args, (err, result) => {})触发插件执行，如果插件有返回值，那么result将接收到插件的返回值。如果插件内部发生错误，那么err将接收到插件抛出的错误
- 通过hook.promise(...args).then(res => {}, err => {})触发插件执行，如果插件有返回值，则hook.promise状态改为resolve，res接收插件的返回值。
如果插件内部发生错误，则hook.promise状态改为reject，err接收到错误值

用法：
```javascript
const hook = new SyncBailHook(['compilation'])
hook.tap('plugin1', (compilation) => {
  console.log('plugin1')
  compilation.sum = compilation.sum + 1
})

hook.tap('plugin2', (compilation) => {
  console.log('plugin2')
  // throw Error('plugin2 抛出错误..')
  compilation.sum = compilation.sum + 2
  return 'haha'; // 除了返回undefined以外，任何值都会中断插件继续往后执行
})

hook.tap('plugin3', (compilation) => {
  console.log('plugin3')
  compilation.sum = compilation.sum + 3
})

const compilation = { sum: 0 }
// 第一种触发方式：通过call触发
hook.call(compilation)
// hook.call经过HookCodeFactory.js生成后的代码
function anonymous(compilation) {
  "use strict";
  var _context;
  var _x = this._x;
  var _fn0 = _x[0];
  var _result0 = _fn0(compilation);
  if(_result0 !== undefined) {
    return _result0;
    ;
  } else {
    var _fn1 = _x[1];
    var _result1 = _fn1(compilation);
    if(_result1 !== undefined) {
      return _result1;
      ;
    } else {
      var _fn2 = _x[2];
      var _result2 = _fn2(compilation);
      if(_result2 !== undefined) {
        return _result2;
        ;
      } else {
      }
    }
  }
}


// 第二种触发方式：通过callAsync
hook.callAsync(compilation, (error , result) => {
  // 如果插件内部发生错误，则不会执行后续的插件，并将错误赋值给error
  console.log('最终回调完成..', error, result)
})
// hook.callAsync经过HookCodeFactory.js生成后的代码
function anonymous(compilation, _callback) {
  "use strict";
  var _context;
  var _x = this._x;
  var _fn0 = _x[0];
  var _hasError0 = false;
  try {
    var _result0 = _fn0(compilation);
  } catch(_err) {
    _hasError0 = true;
    _callback(_err);
  }
  if(!_hasError0) {
    if(_result0 !== undefined) {
      _callback(null, _result0);
      ;
    } else {
      var _fn1 = _x[1];
      var _hasError1 = false;
      try {
        var _result1 = _fn1(compilation);
      } catch(_err) {
        _hasError1 = true;
        _callback(_err);
      }
      if(!_hasError1) {
        if(_result1 !== undefined) {
          _callback(null, _result1);
          ;
        } else {
          var _fn2 = _x[2];
          var _hasError2 = false;
          try {
            var _result2 = _fn2(compilation);
          } catch(_err) {
            _hasError2 = true;
            _callback(_err);
          }
          if(!_hasError2) {
            if(_result2 !== undefined) {
              _callback(null, _result2);
              ;
            } else {
              _callback();
            }
          }
        }
      }
    }
  }
}


// 第三种触发方式：通过promise
hook.promise(compilation).then(res => {
   console.log('最终回调...',res)
}, err => {
   console.log('出错了。。。', err)
})

console.log('执行完成', compilation)
// hook.promise经过HookCodeFactory.js生成后的代码
function anonymous(compilation) {
  "use strict";
  var _context;
  var _x = this._x;
  return new Promise((function(_resolve, _reject) {
    var _sync = true;
    function _error(_err) {
      if(_sync)
        _resolve(Promise.resolve().then((function() { throw _err; })));
      else
        _reject(_err);
    };
    var _fn0 = _x[0];
    var _hasError0 = false;
    try {
      var _result0 = _fn0(compilation);
    } catch(_err) {
      _hasError0 = true;
      _error(_err);
    }
    if(!_hasError0) {
      if(_result0 !== undefined) {
        _resolve(_result0);
        ;
      } else {
        var _fn1 = _x[1];
        var _hasError1 = false;
        try {
          var _result1 = _fn1(compilation);
        } catch(_err) {
          _hasError1 = true;
          _error(_err);
        }
        if(!_hasError1) {
          if(_result1 !== undefined) {
            _resolve(_result1);
            ;
          } else {
            var _fn2 = _x[2];
            var _hasError2 = false;
            try {
              var _result2 = _fn2(compilation);
            } catch(_err) {
              _hasError2 = true;
              _error(_err);
            }
            if(!_hasError2) {
              if(_result2 !== undefined) {
                _resolve(_result2);
                ;
              } else {
                _resolve();
              }
            }
          }
        }
      }
    }
    _sync = false;
  }));
}

```


##### SyncWaterfallHook
插件的返回值有意义，插件的返回值往下一个插件传递，直到传到最终的回调函数。
- 通过hook.call(...args)触发插件执行，捕获不了插件内部抛出的错误，程序崩溃。插件的返回值也接受不到
- 通过hook.callAsync(compilation, (error, result) => {console.log('最终回调完成', error, result)})触发插件执行。
插件的返回值会一直往后面传递，直到传给最终的回调函数，此时error为null，result接收插件的返回值。如果插件内部发生错误，则插件提前退出，不会继续往后面执行，执行最终的回调函数，error接收到错误的值。
- 通过hook.promise(...args).then(res => {}, err => {})。res接收插件的返回值。如果插件内部发生错误，则插件提前退出，不会继续执行后续的插件，
 执行最终的回调函数，此时hook.promise的状态改变为reject，err接收插件抛出的内部错误。

用法：
```javascript
const testhook = new SyncWaterfallHook(['compilation', 'name'])
testhook.tap('plugin1', (compilation, name) => {
  console.log('plugin1', name)
  compilation.sum = compilation.sum + 1
  return compilation
})

testhook.tap('plugin2', (compilation, name) => {
  console.log('plugin2..',name)
  compilation.sum = compilation.sum + 2
  // throw Error('plugin2抛出一个错误')
  // return undefined // 如果返回undefined，那么会将plugin1的返回值传递给plugin3的参数
  return { name: 'plugin2'}; // 将null传递给plugin3
})

testhook.tap('plugin3', (compilation, name) => {
  console.log('plugin3', compilation, name)
  compilation.sum = compilation.sum + 3
  return { test: ''}
})

const compilation = { sum: 0 }
// 第一种触发方式：通过call触发
testhook.call(compilation, 'mike')
// testhook.call(compilation, 'mike')经过HookCodeFactory.js生成的源码如下：
function anonymous(compilation, name) {
  "use strict";
  var _context;
  var _x = this._x;
  var _fn0 = _x[0];
  var _result0 = _fn0(compilation, name);
  if(_result0 !== undefined) {
    compilation = _result0;
  }
  var _fn1 = _x[1];
  var _result1 = _fn1(compilation, name);
  if(_result1 !== undefined) {
    compilation = _result1;
  }
  var _fn2 = _x[2];
  var _result2 = _fn2(compilation, name);
  if(_result2 !== undefined) {
    compilation = _result2;
  }
  return compilation;

}



// 第二种触发方式：通过callAsync
testhook.callAsync(compilation, 'mike', (error, result) => {
   console.log('最终回调完成', error, result)
})
// testhook.callAsync经过HookCodeFactory.js生成的源码如下：
function anonymous(compilation, name, _callback) {
  "use strict";
  var _context;
  var _x = this._x;
  var _fn0 = _x[0];
  var _hasError0 = false;
  try {
    var _result0 = _fn0(compilation, name);
  } catch(_err) {
    _hasError0 = true;
    _callback(_err);
  }
  if(!_hasError0) {
    if(_result0 !== undefined) {
      compilation = _result0;
    }
    var _fn1 = _x[1];
    var _hasError1 = false;
    try {
      var _result1 = _fn1(compilation, name);
    } catch(_err) {
      _hasError1 = true;
      _callback(_err);
    }
    if(!_hasError1) {
      if(_result1 !== undefined) {
        compilation = _result1;
      }
      var _fn2 = _x[2];
      var _hasError2 = false;
      try {
        var _result2 = _fn2(compilation, name);
      } catch(_err) {
        _hasError2 = true;
        _callback(_err);
      }
      if(!_hasError2) {
        if(_result2 !== undefined) {
          compilation = _result2;
        }
        _callback(null, compilation);
      }
    }
  }

}

// 第三种触发方式：通过promise
testhook.promise(compilation, 'mike').then(res => {
   console.log('最终回调...',res)
 }, err => {
  console.log('出错了...', err)
})
console.log('执行完成', compilation)
// testhook.promise经过HookCodeFactory.js生成的源码如下：
function anonymous(compilation, name) {
  "use strict";
  var _context;
  var _x = this._x;
  return new Promise((function(_resolve, _reject) {
    var _sync = true;
    function _error(_err) {
      if(_sync)
        _resolve(Promise.resolve().then((function() { throw _err; })));
      else
        _reject(_err);
    };
    var _fn0 = _x[0];
    var _hasError0 = false;
    try {
      var _result0 = _fn0(compilation, name);
    } catch(_err) {
      _hasError0 = true;
      _error(_err);
    }
    if(!_hasError0) {
      if(_result0 !== undefined) {
        compilation = _result0;
      }
      var _fn1 = _x[1];
      var _hasError1 = false;
      try {
        var _result1 = _fn1(compilation, name);
      } catch(_err) {
        _hasError1 = true;
        _error(_err);
      }
      if(!_hasError1) {
        if(_result1 !== undefined) {
          compilation = _result1;
        }
        var _fn2 = _x[2];
        var _hasError2 = false;
        try {
          var _result2 = _fn2(compilation, name);
        } catch(_err) {
          _hasError2 = true;
          _error(_err);
        }
        if(!_hasError2) {
          if(_result2 !== undefined) {
            compilation = _result2;
          }
          _resolve(compilation);
        }
      }
    }
    _sync = false;
  }));

}


```

##### AsyncSeriesHook
- 可以通过hook.tap，hook.tapAsync，hook.tapPromise注册插件，通过hook.callAsync(...args, finalCb)，hook.promise触发插件执行。不能通过hook.call触发插件执行
- 所有钩子都会异步串行执行
    + 通过testhook.tap(pluginName, (compilation, name) => {})注册的插件，插件执行完，才能继续执行下一个插件
    + 通过testhook.tapAsync(pluginName, (compilation,name, cb) => {})注册的插件，插件执行完并且调用cb，才会继续执行下一个插件
        + 如果没有调用cb，则不会继续执行下一个插件，最终的testhook.callAsync(compilation, 'mike', finalCb)里面的finalCb也不会执行，testhook.promise的状态也不会改变
        + 如果调用了不带参数的cb()，则继续执行下一个插件
        + 如果调用了cb('cb_err')，并且传递了非undefined的值，那么tapable将此行为当作是插件抛出了错误，不会继续执行后续的插件，直接退出并执行
       testhook.callAsync(compilation, err => {})中的finalCb，err值为'cb_err'。如果是通过testhook.promise触发的插件执行，那么testhook.promise的状态
       将改成reject，并且将错误传递给error
    + 如果是通过testhook.promise(pluginName,(compilation, name) => { return new Promise})注册的插件，那么插件一定要返回一个promise，这里称为pro，不然会报错。
     执行插件，并且根据返回的promise的状态进行判断
        + 如果插件pro的状态没有改变，既没有调用resovle，也没有调用reject，那么不会执行后续的插件，也不会执行testhook.callAsync最终的回调，也不会改变testhook.promise的状态
        + 如果pro的状态变成resolve，即插件调用了resolve()，那么继续执行下一个插件
        + 如果pro的状态变为reject，即插件调用了reject('an error')，那么插件会提前退出，并且将错误传递给testhook.callAsync的最终回调，或者testhook.promise
       的状态改为reject，并接收'an error'错误
     + 总结：tapAsync的cb如果带了参数或者hook.tapPromise调用了reject，则直接传给hook.callAsync的最终回调函数，或者传给hook.promise的reject
     
用法：
```javascript

const testhook = new AsyncSeriesHook(['compilation', 'name'])

testhook.tap('plugin1', (compilation, name) => {
  console.log('plugin1', name)
  compilation.sum = compilation.sum + 1
  const start = new Date().getTime();
  // throw Error('plugin1抛出的error')
  while(new Date().getTime() - start < 5000){}
  return 'hah'; // 返回值没什么意义
})

testhook.tapPromise('plugin2', (compilation, name) => {
  return new Promise((resolve, reject) => {
    console.log('plugin2', name)
    setTimeout(() => {
      console.log('plugin2状态改变')
      resolve('success')
      // reject('plugin2.error') //如果调用的是reject，则不会继续走后面的插件，reject的值会被传递给hook.callAsync的回调函数
    }, 2000)
    compilation.sum = compilation.sum + 1
  })
})


testhook.tapAsync('plugin3', (compilation, name,cb) => {
  console.log('plugin3', name, cb)
  compilation.sum = compilation.sum + 4
  setTimeout(() => {
    console.log('plugin3回调')
    // cb();
    cb('plugin3.error', 'plugin3.error2') // 只有第一个参数会传给最终的回调函数
  }, 3000)
})



const compilation = { sum: 0 }
// 第一种方式：通过hook.callAsync调用
testhook.callAsync(compilation, 'mike', function(...args){
  console.log('最终回调', args)
})
// testhook.callAsync经过HookCodeFactory.js编译后的结果
function anonymous(compilation, name, _callback) {
  "use strict";
  var _context;
  var _x = this._x;
  function _next1() {
    var _fn2 = _x[2];
    _fn2(compilation, name, (function(_err2) {
      if(_err2) {
        _callback(_err2);
      } else {
        _callback();
      }
    }));
  }
  var _fn0 = _x[0];
  var _hasError0 = false;
  try {
    _fn0(compilation, name);
  } catch(_err) {
    _hasError0 = true;
    _callback(_err);
  }
  if(!_hasError0) {
    var _fn1 = _x[1];
    var _hasResult1 = false;
    var _promise1 = _fn1(compilation, name);
    if (!_promise1 || !_promise1.then)
      throw new Error('Tap function (tapPromise) did not return promise (returned ' + _promise1 + ')');
    _promise1.then((function(_result1) {
      _hasResult1 = true;
      _next1();
    }), function(_err1) {
      if(_hasResult1) throw _err1;
      _callback(_err1);
    });
  }
}
// 第二种方式：通过testhook.promise触发插件执行
// testhook.promise(compilation, 'name').then(res => {
//   console.log('最终回调', res)
// }, err => {
//   console.log('有错误了。。。', err)
// })
// testhook.promise经过HookCodeFactory.js编译后的源码：
function anonymous(compilation, name) {
  "use strict";
  var _context;
  var _x = this._x;
  return new Promise((function(_resolve, _reject) {
    var _sync = true;
    function _error(_err) {
      if(_sync)
        _resolve(Promise.resolve().then((function() { throw _err; })));
      else
        _reject(_err);
    };
    function _next1() {
      var _fn2 = _x[2];
      _fn2(compilation, name, (function(_err2) {
        if(_err2) {
          _error(_err2);
        } else {
          _resolve();
        }
      }));
    }
    var _fn0 = _x[0];
    var _hasError0 = false;
    try {
      _fn0(compilation, name);
    } catch(_err) {
      _hasError0 = true;
      _error(_err);
    }
    if(!_hasError0) {
      var _fn1 = _x[1];
      var _hasResult1 = false;
      var _promise1 = _fn1(compilation, name);
      if (!_promise1 || !_promise1.then)
        throw new Error('Tap function (tapPromise) did not return promise (returned ' + _promise1 + ')');
      _promise1.then((function(_result1) {
        _hasResult1 = true;
        _next1();
      }), function(_err1) {
        if(_hasResult1) throw _err1;
        _error(_err1);
      });
    }
    _sync = false;
  }));

}
console.log('执行完成', compilation)
```


##### AsyncSeriesLoopHook
- 异步串行循环钩子
- 通过testhook.tap注册的插件，返回值有意义，返回值如果不是undefined，那么将从第一个插件开始重新执行
    + 如果插件内部发生错误，则提前退出插件执行，并执行最终的回调函数，错误参数将传递给testhook.callAsync的最终回调函数的第一个参数，或者testhook.promise的reject参数
- 通过testhook.tapPromise注册的插件，如果promise的resolve(value)，value不是undefined，则从第一个插件开始重新执行。
    + 如果插件内部发生错误，则提前退出插件执行，并执行最终的回调函数，错误参数将传递给testhook.callAsync的最终回调函数的第一个参数
    + 如果promise调用了reject，则提前退出，执行最终的回调函数，并将错误传递给testhook.callAsync的最终回调函数的第一个参数，或者testhook.promise
      的reject参数
-通过testhook.tapAsync(pluginName, (...args, cb) => {cb(err, result)})注册的插件，cb第一个参数用于报告错误，如果err有值，则插件退出，
    执行最终的回调函数。如果result有值且不是undefined，那么hook将会从第一个插件开始重新执行。
    
用法：
```javascript
const testhook = new AsyncSeriesLoopHook(['compilation', 'name'])

let count1 = 2
let count2 = 2
let count3 = 2

testhook.tap('plugin1', (compilation, name) => {
    console.log('plugin1', count1, name)
    compilation.sum = compilation.sum + 1
    // const start = new Date().getTime();
    // while(new Date().getTime() - start < 2000){}
    // throw Error('plugin1抛出的error')
    count1--;
    if(count1 < 1) return;
    return count1; // 返回值有意义
})

testhook.tapPromise('plugin2', (compilation, name) => {
    return new Promise((resolve, reject) => {
        console.log('plugin2', count2, name)
        setTimeout(() => {
            if(count2<1){
                resolve()
            } else {
                resolve(count2)
            }
            count2--;
            // reject('plugin2.error')
        }, 1000)
        compilation.sum = compilation.sum + 1
    })
})


testhook.tapAsync('plugin3', (compilation, name,cb) => {
    console.log('plugin3', count3, name)
    compilation.sum = compilation.sum + 4
    setTimeout(() => {
        if(count3 < 1) {
            cb()
        } else {
            cb(null, count3); // 第一个参数用来报告错误，第二个参数指示是否重新执行
        }
        count3--;
    }, 2000)
    return count3;
})



const compilation = { sum: 0 }
// 第一种方式：通过hook.callAsync调用
// testhook.callAsync(compilation, 'mike', function(err){ // 回调函数的参数用于接收错误信息
//     console.log('执行完成', compilation)
//     console.log('最终回调', err)
// })

// 第二种方式：通过testhook.promise触发插件执行
testhook.promise(compilation, 'name').then(res => {
    console.log('最终回调', res) // res永远为undefined
}, err => {
    console.log('有错误了。。。', err)
})
console.log('最后的语句', compilation)

```

##### AsyncSeriesWaterfallHook
- 异步串行瀑布式钩子。返回值或者参数会往下一个插件传递
- 使用tap注册的插件，如果有返回值，则将返回值往下传。如果没有返回值，则将参数往下传
- 使用tapPromise注册的插件，如果resolve(value)，value不是undefined，则将value往下传。如果value为undefined，则将参数往下传。reject用于报告错误，退出插件执行
- 使用tapAsync注册的插件，如果调用cb(err, result)，err不是undefined，则退出插件执行，报告错误。如果err为undefined，则将result或者参数往下传
- 使用callAsync(...args, (err, result) => {})触发插件执行时，err用于接收插件报告的错误，result用于接收插件传递的值
- 使用promise(...args).then(res => {}, err => {})触发插件执行时，res用于接收插件传递的值，err用于接收插件报告的错误

用法：
```javascript
const testhook = new AsyncSeriesWaterfallHook(['compilation', 'name'])


testhook.tap('plugin1', (name, compilation) => {
  console.log('plugin1', compilation, name)
  compilation.sum = compilation.sum + 1
  // const start = new Date().getTime();
  // while(new Date().getTime() - start < 2000){}
  // throw Error('plugin1抛出的error')
  // return 'plugin1.result'; // 返回值有意义
})

testhook.tapPromise('plugin2', (name, compilation) => {
  return new Promise((resolve, reject) => {
    console.log('plugin2', compilation, name)
    setTimeout(() => {
      resolve();
      // resolve('plugin2.result')
      // reject('plugin2.error')
      compilation.sum = compilation.sum + 1
    }, 1000)
  })
})


testhook.tapAsync('plugin3', (name, compilation,cb) => {
  console.log('plugin3', compilation, name)
  setTimeout(() => {
    compilation.sum = compilation.sum + 4
    cb();
    // cb(null, 'plugin3.result')
    // cb('plugin3.error', 'plugin3.result') // 第一个参数用来报告错误，第二个参数向下传递
  }, 2000)
})



const compilation = { sum: 0 }
// 第一种方式：通过hook.callAsync调用
testhook.callAsync('Mike', compilation, function(err, result){ // 回调函数的参数用于接收错误信息
    console.log('执行完成', compilation)
    console.log('最终回调', err, result)
})

// 第二种方式：通过testhook.promise触发插件执行
// testhook.promise('Mike', compilation).then(res => {
//   console.log('最终回调', res) // res永远为undefined
// }, err => {
//   console.log('有错误了。。。', err)
// })
console.log('最后的语句', compilation)
```


##### AsyncSeriesBailHook
- 异步串行保险钩子
- 通过tap注册的插件，返回值用于提前退出，并传递给testhook.callAsync的第二个参数，testhook.promise的resolve。如果插件内部报错，则将错误传递给testhook.callAsync的第一个参数，testhook.reject。
- 通过tapAsync(pluginName, (...args, cb) => {})注册的插件，cb(err, result)第一个参数用于报告错误，如果err不是undefined，则插件中止执行，并将err传递给testhook.callAsync的第一个参数，或者testhook.promise的reject。如果err为undefined，result不是undefined，那么插件不会继续往后执行，并将result传递给testhook.callAsync的第二个参数，testhook.promise的resolve
- 通过tapPromise注册的插件，如果调用reject(err)，则插件提前退出，并将err传递给testhook.callAsync的第一个参数，testhook.promise的reject。如果调用resolve(value)，value不是undefined，那么插件提前退出，并将result传递给testhook.callAsync的第二个参数，testhook.promise的reject

用法：

```javascript
const testhook = new AsyncSeriesBailHook(['compilation', 'name'])


testhook.tap('plugin1', (name, compilation) => {
    console.log('plugin1', compilation, name)
    compilation.sum = compilation.sum + 1
    // const start = new Date().getTime();
    // while(new Date().getTime() - start < 2000){}
    // throw Error('plugin1抛出的error') // 错误被callAsync的第一个参数接收，或者promise的reject接收
    // return 'plugin1.result'; // 返回值有意义  callAsync的第二个参数接收，或者promise的resolve接收
})

testhook.tapPromise('plugin2', (name, compilation) => {
    return new Promise((resolve, reject) => {
        console.log('plugin2', compilation, name)
        setTimeout(() => {
            resolve();
            // resolve('plugin2.result')
            // reject('plugin2.error')
            compilation.sum = compilation.sum + 1
        }, 1000)
    })
})


testhook.tapAsync('plugin3', (name, compilation,cb) => {
    console.log('plugin3', compilation, name)
    setTimeout(() => {
        compilation.sum = compilation.sum + 4
        // cb();
        cb(null, 'plugin3.result')
        // cb('plugin3.error', 'plugin3.result') // 第一个参数用来报告错误，传递给callAsync的第一个参数。第二个参数用于指示提前退出插件执行，并传递给callAsync的第二个参数
    }, 2000)
})

const compilation = { sum: 0 }
// 第一种方式：通过hook.callAsync调用
// testhook.callAsync('Mike', compilation, function(err, result){ // 回调函数的参数用于接收错误信息
//     console.log('执行完成', compilation)
//     console.log('最终回调', err, result)
// })

// 第二种方式：通过testhook.promise触发插件执行
testhook.promise('Mike', compilation).then(res => {
  console.log('最终回调', res) //
}, err => {
  console.log('有错误了。。。', err)
})
console.log('最后的语句', compilation)

```

##### AsyncParallelHook
- 异步并行钩子。当所有插件执行完成，才会执行最终的回调函数
- 通过tap注册的插件，返回值没有意义。插件内部如果出错，则插件提前退出，则将错误传递给testhook.callAsync最终的回调函数的第一个参数，或者testhook.promise的reject
- 通过tapPromise注册的插件，resolve(value)，value的值没有意义。如果调用了reject，则执行最终的回调函数
- 通过tapAsync注册的插件，cb(value)中如果value不为undefined，则执行最终的回调函数或者promise.reject

用法：
```javascript
const testhook = new AsyncParallelHook(['compilation', 'name'])

testhook.tap('plugin1', (name, compilation) => {
    console.log('plugin1', compilation, name)
    compilation.sum = compilation.sum + 1
    // const start = new Date().getTime();
    // while(new Date().getTime() - start < 2000){}
    // throw Error('plugin1抛出的error') // 错误被callAsync的第一个参数接收，或者promise的reject接收
    // return 'plugin1.result'; // 返回值没有意义
})

testhook.tapPromise('plugin2', (name, compilation) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            console.log('plugin2', compilation, name)
            resolve();
            // reject('plugin2.error') // 调用reject则执行最后的回调函数，或者promise的reject
            compilation.sum = compilation.sum + 1
        }, 1000)
    })
})


testhook.tapAsync('plugin3', (name, compilation,cb) => {
    setTimeout(() => {
        console.log('plugin3', compilation, name)
        compilation.sum = compilation.sum + 4
        // cb();
        cb('plugin3.error') // 第一个参数用来报告错误，传递给callAsync的第一个参数。
    }, 2000)
})
const compilation = { sum: 0 }

// 第一种方式：通过hook.callAsync调用
// testhook.callAsync('Mike', compilation, function(err){ // 回调函数的参数用于接收错误信息
//     console.log('执行完成', compilation)
//     console.log('最终回调', err, result)
// })

// 第二种方式：通过testhook.promise触发插件执行
testhook.promise('Mike', compilation).then(res => {
  console.log('最终回调', res) //
}, err => {
  console.log('有错误了。。。', err)
})
console.log('最后的语句', compilation)
```


##### AsyncParallelBailHook
- 异步并行保险式执行钩子。
- 通过tap注册的插件，如果返回值不是undefined，则直接执行最终的回调函数，并将返回值传递给最终回调函数的第二个参数，或者testhook.promise的resolve。如果插件内部报错，则直接执行最终的回调函数，并将错误值传递给最终回调函数的第一个参数，或者testhook.promise的reject
- 通过tapPromise注册的插件，当调用resolve(value)时，value不是undefined。则执行最终的回调函数，并将value传递给最终回调函数的第二个参数或者testhook.promise的resolve。当调用reject(err)时，直接执行最终回调函数，并将err传递给最终回调函数的第一个参数，或者testhook.promise的reject
- 通过testhook.tapAsync(pluginName, (...args,cb) => {})注册的插件。调用cb(err, result)，如果err不是undefined，则直接执行最终的回调函数，
并将err传递给最终回调函数的第一个参数。如果err为undefined，并且result不是undefined，则直接执行最终的回调函数，并将result传给最终回调函数的第二个参数。

用法：
```javascript


const testhook = new AsyncParallelBailHook(['compilation', 'name'])


/**
 *
 * **/
testhook.tap('plugin1', (compilation, name) => {
  console.log('plugin1', name)
  compilation.sum = compilation.sum + 1
  // throw Error('plugin1.error')
  // return 'plugin1.result';
})

testhook.tapPromise('plugin2', (compilation, name) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      compilation.sum = compilation.sum + 1
      console.log('plugin2', name)
      resolve();
      // resolve('plugin2.result')
      // reject('plugin2.error')
    }, 2000)
  })
})

testhook.tapAsync('plugin3', (compilation, name,cb) => {
  setTimeout(() => {
    compilation.sum = compilation.sum + 4
    console.log('plugin3', name)
    cb();
    // cb(null, 'plugin3.result'); // 第一个参数用于报告错误，第二个参数用于指示直接执行最终回调函数
    // cb('plugin3.error', 'plugin3.result')
  }, 3000)
  // return 'null'
})




const compilation = { sum: 0 }

// 第一种方式：通过hook.callAsync调用
testhook.callAsync(compilation, 'Mike', function(...args){ // 回调函数的参数用于接收错误信息
    console.log('执行完成', compilation)
    console.log('最终回调', ...args)
})

// 第二种方式：通过testhook.promise触发插件执行
// testhook.promise(compilation, 'Mike').then(res => {
//   console.log('最终回调', res) //
// }, err => {
//   console.log('有错误了。。。', err)
// })
console.log('最后的语句', compilation)
```
