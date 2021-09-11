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
