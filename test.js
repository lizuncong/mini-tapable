class AsyncSeriesHook{
  constructor(){
    this.tasks = []
  }
  tapAsync(task){
    this.tasks.push(task)
  }
  callAsync(...args){}
}

const testhook = new AsyncSeriesHook()

testhook.tapAsync((name, compilation, cb) => {
  setTimeout(() => {
    compilation.sum = compilation.sum + 1
    cb() //  调用cb()才能执行下一个回调
  }, 2000)
})

testhook.tapAsync((name, compilation, cb) => {
  console.log( compilation, name)
  setTimeout(() => {
    compilation.sum = compilation.sum + 2
    cb() //  调用cb()才能执行下一个回调
  }, 3000)
})
const compilation = { sum: 0 }

testhook.callAsync('Mike', compilation, function(){
  console.log('所有插件执行完成', compilation)
})