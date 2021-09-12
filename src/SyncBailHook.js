const { SyncBailHook } = require('tapable')

/**
 * 特点：
 *  1.同步串行执行所有的插件回调函数
 *  2.只能通过hook.tap注册插件，可以通过hook.call，hook.callAsync，hook.promise触发插件执行
 *  3.允许中断插件回调函数的执行。有两种方式可以中断：
 *    3.1 如果任意一个插件回调函数有返回值(除了undefined)，那么就会提前退出，不会继续执行后面的插件。直接执行hook.callAsync的finalCb，并将
 *    返回值传递给finalCb的第二个参数。或者直接改变hook.promise为resolve，并将返回值传递给hook.promise的resolve结果
 *    3.2 如果插件内部发生错误，则不会继续执行下一个插件
 *  4. 由于SyncBailHook返回值有意义，需要区分是插件返回值以及插件内部抛出错误两种情况，因此hook.callAsync(...args, (error, result) => {})的回调参数接收
 *  一个error用于接收插件抛出的错误，一个result接收插件的返回值
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

// 第二种触发方式：通过callAsync
hook.callAsync(compilation, (error , result) => {
  // 如果插件内部发生错误，则不会执行后续的插件，并将错误赋值给error
  console.log('最终回调完成..', error, result)
})
// 第三种触发方式：通过promise
// hook.promise(compilation).then(res => {
//   console.log('最终回调...',res)
// }, err => {
//   console.log('出错了。。。', err)
// })

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
