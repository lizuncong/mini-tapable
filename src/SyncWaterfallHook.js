const { SyncWaterfallHook } = require('tapable')


/**
 * 特点：
 *  1.同步串行执行所有的插件回调函数
 *  2.只能通过hook.tap注册插件，但是可以通过hook.call，hook.callAsync，hook.promise触发插件执行
 *  3.当前插件的返回值(不是undefined)，会传递给下一个插件的参数。如果当前插件返回了undefined，那么将上一个插件的返回值传给下一个插件。
 *  4.最后一个插件的返回值会传给hook.callAsync或者hook.promise的回调函数参数
 * **/
class MySyncWaterfallHook{
  constructor(argNames){
    this.argNames = argNames;
    this.tasks = []
  }

  tap(plugin, callback){
    this.tasks.push(callback)
  }

  call(...args){
    let lastRes = args;
    const rest = args.slice(1);
    for(let i = 0; i < this.tasks.length; i++){
      const task = this.tasks[i]
      let res = i === 0 ? task(...lastRes) : task(lastRes, ...rest);
      if(res !== void 0){
        lastRes = res;
      }
    }
  }
}


/**
 * 用法
 * **/
const testhook = new SyncWaterfallHook(['compilation'])
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
// testhook.call(compilation)

// 第二种触发方式：通过callAsync
testhook.callAsync(compilation, (error, result) => {
  console.log('最终回调完成', error, result)
})
// 第三种触发方式：通过promise
// testhook.promise(compilation).then(res => {
//   console.log('最终回调...',res)
// }, err => {
//
// })
console.log('执行完成', compilation)


/**
 * 执行时间比较，平均50倍的差距。。。。
 * **/
// const hook = new SyncWaterfallHook(['compilation'])
// const myHook = new MySyncWaterfallHook(['compilation'])
// const compilation = { sum: 0 }
// const myCompilation = { sum: 0}
// /**
//  * 批量注册插件
//  * **/
// for(let i = 0; i < 1000; i++){
//   hook.tap(`plugin${i}`, (compilation) => {
//     compilation.sum = compilation.sum + i
//   })
//
//   myHook.tap(`plugin${i}`, (compilation) => {
//     compilation.sum = compilation.sum + i
//   })
// }
//
// console.time('tapable')
// hook.call(compilation)
// console.timeEnd('tapable')
//
// console.time('my')
// myHook.call(myCompilation)
// console.timeEnd('my')
//
// console.log(compilation)
// console.log(myCompilation)
