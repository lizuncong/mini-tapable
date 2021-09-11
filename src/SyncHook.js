const { SyncHook } = require('tapable')

/**
 * 特点：
 *  1.同步串行执行所有的插件回调函数
 *  2.只能通过hook.tap注册插件，通过hook.call触发插件执行
 *  3.插件的返回值没什么用
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

const hook = new SyncHook(['compilation'])
const myHook = new MySyncHook(['compilation'])


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




const compilation = { sum: 0 }
const myCompilation = { sum: 0}

/**
 * 计算tapable官方SyncHook执行时间
 * 这里平均6ms多
 * **/
console.time('tapable')
hook.call(compilation)
console.timeEnd('tapable')

/**
 * 计算我们自己的Hook的自行时间
 * 这里平均0.12ms，差距很明显！！！将近50倍的差距
 * **/
console.time('my')
myHook.call(myCompilation)
console.timeEnd('my')

console.log(compilation)
console.log(myCompilation)
