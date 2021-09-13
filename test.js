const { SyncHook } = require('tapable')
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

const compilation = { sum: 0 }
const myCompilation = { sum: 0}

for(let i = 0; i < 1000; i++){
  hook.tap(`plugin${i}`, (compilation) => {
    compilation.sum = compilation.sum + i
  })

  myHook.tap(`plugin${i}`, (compilation) => {
    compilation.sum = compilation.sum + i
  })
}

console.time('tapable')
for(let i = 0; i < 10000; i++){
  hook.call(compilation)
}
console.timeEnd('tapable')

console.time('my')
for(let i = 0; i < 10000; i++){
  myHook.call(myCompilation)
}
console.timeEnd('my')

this.task.push(cb);
this.task.push(cb)

console.log('eerr')