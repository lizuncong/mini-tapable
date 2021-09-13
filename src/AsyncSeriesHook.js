const { AsyncSeriesHook } = require('tapable')


/**
 * 所有的异步钩子均不支持通过hook.call调用
 * 特点：
 *  1.异步串行执行所有的插件回调函数
 *  2.可以通过hook.tap，hook.tapAsync，hook.tapPromise注册插件，通过hook.callAsync(...args, finalCb)，hook.promise触发插件执行。不能通过hook.call触发插件执行
 *  3.所有钩子都会异步串行执行
 *    3.1 如果是通过testhook.tap(pluginName, (...args) => {})注册的插件，则执行直接调用回调函数，回调函数返回值没有意义，执行完回调函数才执行下一个插件
 *    3.2 如果是通过testhook.tapAsync(pluginName, (...restArgs, cb) => {})注册的插件，则执行回调函数，并根据以下条件判断是否继续执行下一个插件
 *      3.2.1 如果回调函数没有调用cb，则不会继续执行下一个插件，最终的testhook.callAsync(...args, finalCb)里面的finalCb也不会执行，testhook.promise的状态也不会改变
 *      3.2.2 如果回调函数调用了cb()，则继续执行下一个插件
 *      3.2.3 如果回调函数调用了cb('')，并且传递了非undefined的值，那么tapable将此行为当作是插件抛出了错误，不会继续执行后续的插件，直接退出并执行
 *      testhook.callAsync(...args, finalCb)中的finalCb，并且将错误传递给finalCb。如果是通过testhook.promise触发的插件执行，那么testhook.promise的状态
 *      将改成reject，并且将错误传递给error
 *    3.3 如果是通过testhook.promise(pluginName,(...args) => { return new Promise})注册的插件，那么插件一定要返回一个promise，这里称为pro，不然会报错。
 *    执行插件，并且根据返回的promise的状态进行判断
 *      3.3.1 如果插件pro的状态没有改变，既没有调用resovle，也没有调用reject，那么不会执行后续的插件，也不会执行testhook.callAsync最终的回调，也不会改变
 *      testhook.promise的状态
 *      3.3.2 如果pro的状态变成resolve，即插件调用了resolve()，那么继续执行下一个插件
 *      3.3.3 如果pro的状态变为reject，即插件调用了reject('an error')，那么插件会提前退出，并且将错误传递给testhook.callAsync的最终回调，或者testhook.promise
 *      的状态改为reject，并接收'an error'错误
 *
 * **/

class MyAsyncSeriesHook{
  constructor(argNames) {
    this._argNames = argNames;
    this.tasks = [];
  }

  tap(name, task){
    this.tasks.push({
      type: 'sync',
      fn: task,
      pluginName: name
    })
  }
  tapPromise(name, task){
    this.tasks.push({
      type: 'promise',
      fn: task,
      pluginName: name
    })
  }
  tapAsync(name, task){
    this.tasks.push({
      type: 'async',
      fn: task,
      pluginName: name
    })
  }

  callAsync(...args){
    const finalCallback = args.pop();
    const next = (idx) => {
      if(idx === this.tasks.length) {
        finalCallback();
        return;
      }
      const task = this.tasks[idx];
      if(task.type === 'sync'){
        task.fn(...args)
        next(idx + 1)
      }
      if(task.type === 'async'){
        const cb = (err) => {
          if(err !== undefined) {
            finalCallback(err);
            return
          }
          next(idx+1)
        }
        task.fn(...args, cb)
      }
      if(task.type === 'promise'){
        task.fn(...args).then(() => { next(idx+1)}, err => finalCallback(err))
      }
    }
    next(0)
  }
  promise(...args){
    return new Promise((resolve, reject) => {
      const finalCallback = (err) => {
        if(err){
          reject(err)
        } else {
          resolve()
        }
      }
      this.callAsync(...args, finalCallback)
    })
  }
}

const testhook = new AsyncSeriesHook(['compilation', 'name'])
// const testhook = new MyAsyncSeriesHook(['compilation', 'name'])


/**
 *
 * **/
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
      resolve('plugin2.success')
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
    cb();
    // cb('plugin3.error', 'plugin3.error2') // 只有第一个参数会传给最终的回调函数
  }, 3000)
})



const compilation = { sum: 0 }
// 第一种方式：通过hook.callAsync调用
// testhook.callAsync(compilation, 'mike', function(...args){
//   console.log('最终回调', args)
// })

// 第二种方式：通过testhook.promise触发插件执行
testhook.promise(compilation, 'name').then(res => {
  console.log('最终回调', res)
}, err => {
  console.log('有错误了。。。', err)
})
console.log('执行完成', compilation)


/**
 * 执行时间比较。。。。
 * **/
// const hook = new AsyncSeriesHook(['compilation', 'name'])
// const myHook = new MyAsyncSeriesHook(['compilation', 'name'])
// const compilation = { sum: 0, name: '' }
// const myCompilation = { sum: 0, name: ''}
// /**
//  * 批量注册插件
//  * **/
// for(let i = 0; i < 1000; i++){
//   hook.tapAsync(`plugin${i}`, (compilation, name, cb) => {
//     compilation.sum = compilation.sum + i
//     cb()
//   })
//
//   myHook.tapAsync(`plugin${i}`, (compilation, name, cb) => {
//     compilation.sum = compilation.sum + i
//     cb()
//   })
// }
//
// console.time('tapable')
// hook.callAsync(compilation, 'mike', () => {
//   console.log(compilation)
//   console.timeEnd('tapable')
// })
//
// console.time('my')
// myHook.callAsync(myCompilation, 'mike', () => {
//   console.log(myCompilation)
//   console.timeEnd('my')
// })

