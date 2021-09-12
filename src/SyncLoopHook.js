const { SyncLoopHook } = require('tapable')

/**
 * 特点：
 *  1.同步串行执行所有的插件回调函数
 *  2.只能通过hook.tap注册插件，可以通过hook.call，hook.callAsync，hook.promise触发插件执行。hook.callAsync的回调函数以及hook.promise的then没有参数
 *  3.如果一个插件返回了不是undefined的值，那么hook将会从第一个插件开始重新执行
 *  4.如果插件内部抛出一个错误，则插件退出，直接执行最终的回调。hook.callAsync将接收到一个错误参数。hook.promise的状态将改为reject
 *  5.由于插件的返回值不会传递给最终的finalCb，因此finalCb接收的参数是error
 * **/
class MySyncLoopHook{
  constructor(argNames){
    this.argNames = argNames;
    this.tasks = []
  }

  tap(plugin, callback){
    this.tasks.push(callback)
  }

  call(...args){
    // 第一种思路递归有爆栈的风险
    // const loop = (index) => {
    //   for(let i = 0; i <= index; i++){
    //     const task = this.tasks[i]
    //     const result = task(...args)
    //     if(result !== void 0){
    //       loop(i)
    //     }
    //   }
    // }
    // loop(this.tasks.length - 1)
    // 第二种思路
    let loop;
    do{
      loop = false;
      for(let i = 0; i < this.tasks.length; i++){
        const task = this.tasks[i]
        if(task(...args)!== void 0){
          loop = true
          break;
        }
      }

    } while(loop)
  }
}
/**
 * 用法
 * **/
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
// testhook.call(compilation)

// 第二种触发方式：通过callAsync
// testhook.callAsync(compilation, (error) => {
//   console.log('最终回调完成..', error)
// })
// 第三种触发方式：通过promise
testhook.promise(compilation).then(res => {
  console.log('最终回调...',res)
}, err => {
  console.log('出错了...', err)
})
console.log('执行完成', compilation)


/**
 * 执行时间比较，平均50倍的差距。。。。
 * **/
// const hook = new SyncLoopHook(['compilation'])
// const myHook = new MySyncLoopHook(['compilation'])
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
