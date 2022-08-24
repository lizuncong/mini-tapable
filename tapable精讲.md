[完整的手写源码仓库](https://github.com/lizuncong/mini-tapable)

>`tapable`是`webpack` 插件机制核心。 `mini-tapable` 不仅解读官方 `tapable` 的源码，还用自己的思路去实现一遍，并且和官方的运行时间做了个比较，我和webpack作者相关的讨论可以[点击查看](https://github.com/webpack/tapable/issues/162)。`webpack tapable` 源码内部根据 `new Function` 动态生成函数执行体这种优化方式不一定是好的。当我们熟悉了 tapable 后，就基本搞懂了 webpack plugin 的底层逻辑，再回头看 webpack 源码就轻松很多

## 目录
- src目录。这个目录下是手写所有的 `tapable hook` 的源码，每个 `hook` 都用自己的思路实现一遍，并且和官方的 `hook` 执行时间做个对比。

## tapable的设计理念：单态、多态及内联缓存
由于在 `webpack` 打包构建的过程中，会有上千(数量其实是取决于自身业务复杂度)个插件钩子执行，同时同类型的钩子在执行时，函数参数固定，函数体相同，因此 `tapable` 针对这些业务场景进行了相应的优化。这其中最重要的是运用了[单态性及多态性概念](https://mrale.ph/blog/2015/01/11/whats-up-with-monomorphism.html)，[内联缓存](https://www.youtube.com/watch?v=_VHNTC67NR8&list=LLizbG0yniVesaKsnay8krQQ&index=5&t=164s)的原理，也可以看这个[issue](https://github.com/webpack/tapable/issues/62)。为了达到这个目标，`tapable` 采用 `new Function` 动态生成函数执行体的方式，主要逻辑在源码的 [HookCodeFactory.js文件中](https://github.com/webpack/tapable/blob/master/lib/HookCodeFactory.js)。

## 如何理解 tapable 的设计理念
思考下面两种实现方法，哪一种执行效率高，哪一种实现方式简洁？
```javascript

// 方法一：
const callFn = (...tasks) => (...args) => {
   for (const fn of tasks) {
      fn(...args)
    }
}

// 方法二：
const callFn2 = (a, b, c) => (x, y) => {
  a(x, y);
  b(x, y);
  c(x, y);
}

```
`callFn` 及 `callFn2` 的目的都是为了实现将一组方法以相同的参数调用，依次执行。很显然，方法一效率明显更高，并且容易扩展，能支持传入数量不固定的一组方法。但是，如果根据[单态性以及内联缓存](https://mrale.ph/blog/2015/01/11/whats-up-with-monomorphism.html)的说法，很明显方法二的执行效率更高，同时也存在一个问题，即只支持传入a，b，c三个方法，参数形态也固定，这种方式显然没有方法一灵活，那能不能同时兼顾效率以及灵活性呢？答案是可以的。我们可以借助 `new Function` 动态生成函数体的方式。

```js
class HookCodeFactory {
  constructor(args) {
    this._argNames = args;
    this.tasks = [];
  }
  tap(task) {
    this.tasks.push(task);
  }
  createCall() {
    let code = "";
    // 注意思考这里是如何拼接参数已经函数执行体的
    const params = this._argNames.join(",");
    for (let i = 0; i < this.tasks.length; i++) {
      code += `
        var callback${i} = this.tasks[${i}];
        callback${i}(${params})
      `;
    }
    return new Function(params, code);
  }
  call(...args) {
    const finalCall = this.createCall();
    // 将函数打印出来，方便观察最终拼接后的结果
    console.log(finalCall);
    return finalCall.apply(this, args);
  }
}

// 构造函数接收的arg数组里面的参数，就是task a、b、c三个函数的参数
const callFn = new HookCodeFactory(["x", "y", "z"]);

const a = (x, y, z) => {
  console.log("task a:", x, y, z);
};

const b = (x, y, z) => {
  console.log("task b:", x, y, z);
};

const c = (x, y, z) => {
  console.log("task c:", x, y, z);
};

callFn.tap(a);
callFn.tap(b);
callFn.tap(c);

callFn.call(4, 5, 6);

```
当我们在浏览器控制台执行上述代码时：

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e238f17ee0a449dab81ea9368afb2f07~tplv-k3u1fbpfcp-watermark.image?)
拼接后的完整函数执行体：

![image.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f140855df9f84cd7bc71ec972552a183~tplv-k3u1fbpfcp-watermark.image?)

可以看到，通过这种动态生成函数执行体的方式，我们能够同时兼顾性能及灵活性。我们可以通过 `tap` 方法添加任意数量的任务，同时通过在初始化构造函数时 `new HookCodeFactory(['x', 'y', ..., 'n'])` 传入任意参数。

实际上，这正是官方 `tapable` 的[HookCodeFactory.js](https://github.com/webpack/tapable/blob/master/lib/HookCodeFactory.js)的简化版本。这是 `tapable` 的精华所在。

## tapable源码解读
`tapable` 最主要的源码在 `Hook.js` 以及 `HookCodeFactory.js`中。`Hook.js` 主要是提供了 `tap`、`tapAsync`、`tapPromise`等方法，每个 `Hook` 都在构造函数内部调用 `const hook = new Hook()`初始化 `hook` 实例。`HookCodeFactory.js` 主要是根据 `new Function` 动态生成函数执行体。

### demo
以 `SyncHook.js` 为例，`SyncHook` 钩子使用如下：
```js
const { SyncHook } = require("tapable");
debugger;
const testhook = new SyncHook(["compilation", "name"]);
// 注册 plugin1
testhook.tap("plugin1", (compilation, name) => {
  console.log("plugin1", name);
  compilation.sum = compilation.sum + 1;
});

// 注册 plugin2
testhook.tap("plugin2", (compilation, name) => {
  console.log("plugin2..", name);
  compilation.sum = compilation.sum + 2;
});

// 注册 plugin3
testhook.tap("plugin3", (compilation, name) => {
  console.log("plugin3", compilation, name);
  compilation.sum = compilation.sum + 3;
});

const compilation = { sum: 0 };
// 第一次调用
testhook.call(compilation, "my test 1");
// 第二次调用
testhook.call(compilation, "my test 2");
// 第三次调用
testhook.call(compilation, "my test 3");
...
// 第n次调用
testhook.call(compilation, "my test n");
```
我们用这个demo做为用例，一步步debug。

### `SyncHook.js`源码
主要逻辑如下：
```js
const Hook = require("./Hook");
const HookCodeFactory = require("./HookCodeFactory");

// 继承 HookCodeFactory
class SyncHookCodeFactory extends HookCodeFactory {}

const factory = new SyncHookCodeFactory();

const COMPILE = function(options) {
    factory.setup(this, options);
    return factory.create(options);
};

function SyncHook(args = [], name = undefined) {
    // 初始化 Hook
    const hook = new Hook(args, name);
    // 注意这里修改了 hook 的constructor
    hook.constructor = SyncHook;
    ...
    // 每个钩子都必须自行实现自己的 compile 方法！！！
    hook.compile = COMPILE;
    return hook;
}
```

### `Hook.js`源码
主要逻辑如下：
```js
// 问题一：思考一下为什么需要 CALL_DELEGATE
const CALL_DELEGATE = function(...args) {
    // 当第一次调用时，实际上执行的是 CALL_DELEGATE 方法
    this.call = this._createCall("sync");
    // 当第二次或者第n次调用时，此时 this.call 方法已经被设置成 this._createCall 的返回值
    return this.call(...args);
};
...
class Hook {
    constructor(args = [], name = undefined) {
        this._args = args;
        this.name = name;
        this.taps = []; // 存储我们通过 hook.tap 注册的插件
        this.interceptors = [];
        this._call = CALL_DELEGATE;
        // 初始化时，this.call被设置成CALL_DELEGATE
        this.call = CALL_DELEGATE;
        ...
        
        // 问题三：this._x = undefined 是什么
        this._x = undefined; // this._x实际上就是this.taps中每个插件的回调
        
        // 问题四：为什么需要在构造函数中绑定这些函数
        this.compile = this.compile;
        this.tap = this.tap;
        this.tapAsync = this.tapAsync;
        this.tapPromise = this.tapPromise;
    }
    // 每个钩子必须自行实现自己的 compile 方法。compile方法根据 this.taps以及 this._args动态生成函数执行体
    compile(options) {
        throw new Error("Abstract: should be overridden");
    }

    // 生成函数执行体
    _createCall(type) {
        return this.compile({
            taps: this.taps,
            interceptors: this.interceptors,
            args: this._args,
            type: type
        });
    }
    ...
    _tap(type, options, fn) {
        ...
        this._insert(options);
    }
    tap(options, fn) {
        this._tap("sync", options, fn);
    }
    _resetCompilation() {
        this.call = this._call;
        this.callAsync = this._callAsync;
        this.promise = this._promise;
    }
    _insert(item) {
        // 问题二：为什么每次调用 testhook.tap() 注册插件时，都需要重置this.call等方法？
        this._resetCompilation();
        ...
    }    
}
```
#### 思考Hook.js源码中的几个问题
- 问题一：为什么需要 CALL_DELEGATE
- 问题二：为什么每次调用 testhook.tap() 注册插件时，都需要重置this.call等方法？
- 问题三：this._x = undefined 是什么
- 问题四：为什么需要在构造函数中绑定 `this.compile `、`this.tap`、`this.tapAsync `以及`this.tapPromise`等方法


当我们每次调用 `testhook.tap` 方法注册插件时，流程如下：

![未命名文件.jpg](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/eb30b80d563a4567b6e07a2fc26fabb9~tplv-k3u1fbpfcp-watermark.image?)

方法往`this.taps`数组中添加一个插件。`this.__insert` 方法逻辑比较简单，但这里有一个细节需要注意一下，**为什么每次注册插件时，都需要调用this._resetCompilation()重置this.call等方法？** 我们稍后再看下这个问题。先继续debug。

当我们 **第一次(注意是第一次)** 调用 `testhook.call` 时，实际上调用的是 `CALL_DELEGATE` 方法
```js
const CALL_DELEGATE = function(...args) {
    // 当第一次调用时，实际上执行的是 CALL_DELEGATE 方法
    this.call = this._createCall("sync");
    // 当第二次或者第n次调用时，此时 this.call 方法已经被缓存成 this._createCall 的返回值
    return this.call(...args);
};
```
`CALL_DELEGATE` 调用 `this._createCall` 函数根据注册的 `this.taps` 动态生成函数执行体。并且 `this.call` 被设置成 `this._createCall` 的返回值缓存起来，如果 `this.taps` 改变了，则需要重新生成。

此时如果我们第二次调用 `testhook.call` 时，就不需要再重新动态生成一遍函数执行体。**这也是tapable的优化技巧之一**。这也回答了 **问题一：为什么需要 CALL_DELEGATE**。

如果我们调用了n次 `testhook.call`，然后又调用 `testhook.tap` 注册插件，此时 `this.call` 已经不能重用了，需要再根据 `CALL_DELEGATE` 重新生成一次函数执行体，**这也回答了问题二：为什么每次调用 testhook.tap() 注册插件时，都需要重置this.call等方法**。可想而知重新生成的过程是很耗时的。因此我们在使用 `tapable` 时，最好一次性注册完所有插件，再调用 `call`
```js
testhook.tap("plugin1");
testhook.tap("plugin2");
testhook.tap("plugin3");


testhook.call(compilation, "my test 1"); // 第一次调用 call 时，会调用CALL_DELEGATE动态生成函数执行体并缓存起来
testhook.call(compilation, "my test 2"); // 不会重新生成函数执行体，使用第一次的
testhook.call(compilation, "my test 3"); // 不会重新生成函数执行体，使用第一次的
```

避免下面的调用方式：

```js
testhook.tap("plugin1");
testhook.call(compilation, "my test 1"); // 第一次调用 call 时，会调用CALL_DELEGATE动态生成函数执行体并缓存起来

testhook.tap("plugin2");
testhook.call(compilation, "my test 2"); // 重新调用CALL_DELEGATE生成函数执行体

testhook.tap("plugin3");
testhook.call(compilation, "my test 3"); // 重新调用CALL_DELEGATE生成函数执行体
```

现在让我们看看第三个问题，调用 `this.compile` 方法时，实际上会调用 `HookCodeFacotry.js` 中的 `setup` 方法：

```js
setup(instance, options) {
    instance._x = options.taps.map(t => t.fn);
}
```

对于问题四，实际上这和 V8 引擎的 `Hidden Class` 有关，通过在构造函数中绑定这些方法，类中的属性形态固定，这样在查找这些方法时就能利用 V8 引擎中 `Hidden Class` 属性查找机制，提高性能。

### HookCodeFactory.js
主要逻辑：
```js
class HookCodeFactory {
    constructor(config) {
        this.config = config;
        this.options = undefined;
        this._args = undefined;
    }
    create(options){
    	this.init(options);
        let fn;
        switch (this.options.type) {
            case 'sync': 
                fn = new Function(
                    ...
                )
                break
            case 'async': 
                fn = new Function(
                    ...
                )
                break
            case 'promise': 
                fn = new Function(
                    ...
                )
                break
        }
        this.deinit();
        return fn;
    }
    setup(instance, options) {
        instance._x = options.taps.map(t => t.fn);
    }
    ...
}
```

## 手写 tapable 每个 Hook
手写 tapable中所有的 hook，并比较我们自己实现的 hook 和官方的执行时间

![image.png](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/47cd27eacf54464bb22212496d2a59ad~tplv-k3u1fbpfcp-watermark.image?)

这里面每个文件都会实现一遍 官方的 hook，并比较执行时间，以 SyncHook 为例，批量注册1000个插件时，我们自己手写的 MySyncHook执行时间0.12ms，而官方的需要6ms，这中间整整50倍的差距！！！

![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8291f85c646a49089941d3451f4e4f41~tplv-k3u1fbpfcp-watermark.image?)

具体可以看[我的仓库](https://github.com/lizuncong/mini-tapable)
