const { SyncHook } = require('tapable')

/**
 * 特点：
 *  1.同步串行执行所有的插件回调函数
 *  2.只能通过hook.tap注册插件，可以通过hook.call，hook.callAsync，hook.promise触发插件执行
 *  3.插件的返回值没什么用，并且不会传递给hook.callAsync或者hook.promise的返回值
 * **/

class MySyncHook{
  constructor(argNames){
    this.argNames = argNames;
    this.tasks = []
  }

  tap(plugin, callback){
    this.tasks.push(callback)
  }

  call(...args){
    this.tasks.forEach(task => task(...args))
  }
}

const testhook = new SyncHook(['compilation'])
testhook.tap('plugin1', (compilation, name) => {
  console.log('plugin1', name)
  compilation.sum = compilation.sum + 1
  return compilation
})

testhook.tap('plugin2', (compilation, name) => {
  console.log('plugin2..',name)
  compilation.sum = compilation.sum + 2
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
// testhook.callAsync(compilation, (...args) => {
//   console.log('最终回调完成..', ...args)
// })
// 第三种触发方式：通过promise
testhook.promise(compilation).then(res => {
  console.log('最终回调...',res)
}, err => {

})
console.log('执行完成', compilation)

//
// const hook = new SyncHook(['compilation'])
// const myHook = new MySyncHook(['compilation'])


/**
 * 批量注册插件
 * **/
// for(let i = 0; i < 1000; i++){
//   hook.tap(`plugin${i}`, (compilation) => {
//     compilation.sum = compilation.sum + i
//   })
//
//   myHook.tap(`plugin${i}`, (compilation) => {
//     compilation.sum = compilation.sum + i
//   })
// }




// const compilation = { sum: 0 }
// const myCompilation = { sum: 0}
//
// /**
//  * 计算tapable官方SyncHook执行时间
//  * 这里平均6ms多
//  * **/
// console.time('tapable')
// hook.call(compilation)
// console.timeEnd('tapable')
//
// /**
//  * 计算我们自己的Hook的自行时间
//  * 这里平均0.12ms，差距很明显！！！将近50倍的差距
//  * **/
// console.time('my')
// myHook.call(myCompilation)
// console.timeEnd('my')
//
// console.log(compilation)
// console.log(myCompilation)
