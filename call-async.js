class AsyncSeriesHook{
    constructor(){
      this.tasks = []
    }
    tapAsync(task){
      this.tasks.push(task)
    }
    callAsync(...args){
        const finalCallback = args.pop();
        const next = (idx) => {
            if(idx === this.tasks.length) {
                finalCallback();
                return;
            }
            const task = this.tasks[idx];
            const cb = (err) => {
                if(err !== undefined) {
                    finalCallback(err);
                    return
                }
                next(idx+1)
            }
            task(...args, cb)
        }
        next(0)
    }
}
  
const testhook = new AsyncSeriesHook()
  
testhook.tapAsync((name, compilation, cb) => {
    console.log('plugin1 开始执行', name, compilation)
    setTimeout(() => {
        compilation.sum = compilation.sum + 1
        console.log('plugin1 结束执行', name, compilation)
        cb() //  调用cb()才能执行下一个回调
    }, 2000)
})
  
testhook.tapAsync((name, compilation, cb) => {
    console.log('plugin2 开始执行', name, compilation)
    setTimeout(() => {
      compilation.sum = compilation.sum + 2
      console.log('plugin2 结束执行', name, compilation)
      cb() //  调用cb()才能执行下一个回调
    }, 3000)
})
const compilation = { sum: 0 }
  
testhook.callAsync('Mike', compilation, function(){
    console.log('所有插件执行完成', compilation)
})
