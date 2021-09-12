### tapable
webpack插件机制的核心。小而美又强的一个库。核心原理也是依赖于发布订阅模式

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

- 约定.hook.callAsync(...args, finalCb)。finalCb = () => {}
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


- SyncLoopHook 插件的返回值有意义。插件如果有返回非undefined的值，则hook会从第一个插件开始重新执行。如果插件返回undefined，则继续执行下一个插件
    + 通过hook.call(...args)触发插件执行，捕获不了插件内部抛出的错误，程序崩溃
    + 通过hook.callAsync(...args, err => {})触发插件执行，如果插件内部发生错误，不会继续执行后续的插件，执行最终的回调函数，err接收错误的值
    + 通过hook.promise(...args).then(res => {}, err => {})。res不会接收任何值。如果插件内部发生错误，则不会执行后续的插件，直接改变
    hook.promise的状态，err接收插件抛出的错误
- SyncBailHook。插件的返回值有意义，如果插件返回了非undefined的值比如result，那么插件提前退出，不会继续执行后续插件。执行最终的回调函数。如果插件
    返回undefined，则继续执行后续的插件
    + 通过hook.call(...args)触发插件执行，捕获不了插件内部抛出的错误，程序崩溃。插件的返回值也接受不到
    + 通过hook.callAsync(...args, (err, result) => {})触发插件执行，如果插件有返回值，那么result将接收到插件的返回值。如果插件内部发生错误，
    那么err将接收到插件抛出的错误
    + 通过hook.promise(...args).then(res => {}, err => {})触发插件执行，如果插件有返回值，则hook.promise状态改为resolve，res接收插件的返回值。
    如果插件内部发生错误，则hook.promise状态改为reject，err接收到错误值
        
+ SyncWaterfallHook。插件的返回值有意义，插件的返回值往下一个插件传递，直到传到最终的回调函数。
        + 通过hook.call(...args)触发插件执行，捕获不了插件内部抛出的错误，程序崩溃。插件的返回值也接受不到
        + 通过hook.callAsync(compilation, (error, result) => {console.log('最终回调完成', error, result)})触发插件执行。
        插件的返回值会一直往后面传递，直到传给最终的回调函数，此时error为null，result接收插件的返回值。如果插件内部发生错误，则插件提前退出，不会继续往后面执行，执行最终的回调函数，error接收到错误的值。
        + 通过hook.promise(...args).then(res => {}, err => {})。res接收插件的返回值。如果插件内部发生错误，则插件提前退出，不会继续执行后续的插件，
        执行最终的回调函数，此时hook.promise的状态改变为reject，err接收插件抛出的内部错误。
