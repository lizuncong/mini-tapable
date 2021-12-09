const { SyncWaterfallHook } = require('tapable')

const testhook = new SyncWaterfallHook(['compilation', 'name'])
testhook.tap('plugin1', (compilation, name) => {
  console.log('plugin1', compilation, name)
  compilation.sum = compilation.sum + 1
  return compilation
})

testhook.tap('plugin2', (compilation, name) => {
  console.log('plugin2..', compilation,name)
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
// testhook.call(compilation, 'mike')

// 第二种触发方式：通过callAsync
// testhook.callAsync(compilation, 'mike', (error, result) => {
//    console.log('最终回调完成', error, result)
// })
// 第三种触发方式：通过promise
testhook.promise(compilation, 'mike').then(res => {
   console.log('最终回调...',res)
 }, err => {
  console.log('出错了...', err)
})
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
