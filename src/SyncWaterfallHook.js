const { SyncWaterfallHook } = require('tapable')


/**
 * 特点：
 *  1.同步串行执行所有的插件回调函数
 *  2.只能通过hook.tap注册插件，通过hook.call触发插件执行，hook.call只能接收一个参数
 *  3.当前插件的返回值(不是undefined)，会传递给下一个插件的参数。如果当前插件返回了undefined，那么将上一个插件的返回值传给下一个插件
 * **/
class MySyncWaterfallHook{
  constructor(argNames){
    this.argNames = argNames;
    this.tasks = []
  }

  tap(plugin, callback){
    this.tasks.push(callback)
  }

  call(arg){
    let lastRes = arg;
    for(let i = 0; i < this.tasks.length; i++){
      const task = this.tasks[i]
      const res = task(lastRes);
      if(res !== void 0){
        lastRes = res;
      }
    }
  }
}


/**
 * 用法
 * **/
// const testhook = new MySyncWaterfallHook(['compilation'])
// testhook.tap('plugin1', (compilation) => {
//   compilation.sum = compilation.sum + 1
//   return compilation
// })
//
// testhook.tap('plugin2', (compilation) => {
//   compilation.sum = compilation.sum + 2
//   return undefined // 如果返回undefined，那么会将plugin1的返回值传递给plugin3的参数
//   // return null; // 将null传递给plugin3
// })
//
// testhook.tap('plugin3', (compilation) => {
//   console.log(compilation)
//   compilation.sum = compilation.sum + 3
//   return compilation
// })
//
// const compilation = { sum: 0 }
// testhook.call(compilation)
// console.log('执行完成', compilation)


/**
 * 执行时间比较，平均50倍的差距。。。。
 * **/
const hook = new SyncWaterfallHook(['compilation'])
const myHook = new MySyncWaterfallHook(['compilation'])
const compilation = { sum: 0 }
const myCompilation = { sum: 0}
/**
 * 批量注册插件
 * **/
for(let i = 0; i < 1000; i++){
  hook.tap(`plugin${i}`, (compilation) => {
    compilation.sum = compilation.sum + i
  })

  myHook.tap(`plugin${i}`, (compilation) => {
    compilation.sum = compilation.sum + i
  })
}

console.time('tapable')
hook.call(compilation)
console.timeEnd('tapable')

console.time('my')
myHook.call(myCompilation)
console.timeEnd('my')

console.log(compilation)
console.log(myCompilation)
