const { SyncLoopHook } = require('tapable')

/**
 * 特点：
 *  1.同步串行执行所有的插件回调函数
 *  2.只能通过hook.tap注册插件，通过hook.call触发插件执行
 *  3.如果一个插件返回了不是undefined的值，那么hook将会从第一个插件开始重新执行
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
  if(count < 1) return undefined;
  return null; // 返回了非undefined的值，因此hook执行到这里又会从第一个插件开始重新执行
})

testhook.tap('plugin3', (compilation) => {
  console.log('plugin3')
  compilation.sum = compilation.sum + 3
})

const compilation = { sum: 0 }
testhook.call(compilation)
console.log('执行完成', compilation)
