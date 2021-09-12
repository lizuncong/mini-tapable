const { SyncBailHook } = require('tapable')

/**
 * 特点：
 *  1.同步串行执行所有的插件回调函数
 *  2.只能通过hook.tap注册插件，可以通过hook.call，hook.callAsync，hook.promise触发插件执行
 *  3.允许中断插件回调函数的执行。如果任意一个插件回调函数有返回值(除了undefined)，那么就会提前退出，不会继续执行后面的插件。并且将
 *  返回值传递给hook.callAsync以及hook.promise的返回值
 * **/

class MySyncBailHook{
  constructor(argNames){
    this.argNames = argNames;
    this.tasks = []
  }

  tap(plugin, callback){
    this.tasks.push(callback)
  }

  call(...args){
    for(let i = 0; i < this.tasks.length; i++){
      const task = this.tasks[i];
      if(task(...args) !== void 0) {
        break
      }
    }
  }
}


/**
 * 用法
 * **/
const hook = new SyncBailHook(['compilation'])
hook.tap('plugin1', (compilation) => {
  console.log('plugin1')
  compilation.sum = compilation.sum + 1
})

hook.tap('plugin2', (compilation) => {
  console.log('plugin2')
  compilation.sum = compilation.sum + 2
  // return 'haha'; // 除了返回undefined以外，任何值都会中断插件继续往后执行
})

hook.tap('plugin3', (compilation) => {
  console.log('plugin3')
  compilation.sum = compilation.sum + 3
})

const compilation = { sum: 0 }
// 第一种触发方式：通过call触发
// hook.call(compilation)

// 第二种触发方式：通过callAsync
// hook.callAsync(compilation, (...args) => {
//   console.log('最终回调完成..', ...args)
// })
// 第三种触发方式：通过promise
hook.promise(compilation).then(res => {
  console.log('最终回调...',res)
}, err => {

})

console.log('执行完成', compilation)



/**
 * 执行时间比较，平均50倍的差距。。。。
 * **/
// const hook = new SyncBailHook(['compilation'])
// const myHook = new MySyncBailHook(['compilation'])
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
