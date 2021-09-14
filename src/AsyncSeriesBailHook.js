const { AsyncSeriesBailHook } = require('tapable')


/**
 * 特点：
 * 1. 异步串行保险钩子
 * 2. 通过tap注册的插件，返回值用于提前退出，并传递给testhook.callAsync的第二个参数，testhook.promise的resolve。如果插件内部报错，则将错误传递给
 *    testhook.callAsync的第一个参数，testhook.reject。
 * 3. 通过tapAsync(pluginName, (...args, cb) => {})注册的插件，cb(err, result)第一个参数用于报告错误，如果err不是undefined，则插件中止执行，并将err传递给
 *    testhook.callAsync的第一个参数，或者testhook.promise的reject。如果err为undefined，result不是undefined，那么插件不会继续往后执行，并将result传递给
 *    testhook.callAsync的第二个参数，testhook.promise的resolve
 * 4. 通过tapPromise注册的插件，如果调用reject(err)，则插件提前退出，并将err传递给testhook.callAsync的第一个参数，testhook.promise的reject。
 *    如果调用resolve(value)，value不是undefined，那么插件提前退出，并将result传递给testhook.callAsync的第二个参数，testhook.promise的reject
 * **/

class MyAsyncSeriesBailHook{
    constructor(argNames){
        this._argNames = argNames;
        this.tasks = []
    }
    tap(pluginName, task){
        this.tasks.push({
            type: 'sync',
            fn: task,
            pluginName: pluginName
        })
    }
    tapPromise(pluginName, task){
        this.tasks.push({
            type: 'promise',
            fn: task,
            pluginName: pluginName
        })
    }
    tapAsync(pluginName, task){
        this.tasks.push({
            type: 'async',
            fn: task,
            pluginName: pluginName
        })
    }

    callAsync(...args){
        const finalCallback = args.pop();
        const next = (idx) => {
            if(idx === this.tasks.length){
                return finalCallback()
            }
            const task = this.tasks[idx]
            const fn = task.fn;
            if(task.type === 'sync'){
                const res = fn(...args)
                if(res){
                    finalCallback(null, res)
                } else {
                    next(idx + 1)
                }
            }
            if(task.type === 'promise'){
                fn(...args).then(res => {
                    if(res !== void 0){
                        finalCallback(null, res)
                    } else {
                        next(idx + 1)
                    }
                }, err => {
                    finalCallback(err)
                })
            }
            if(task.type === 'async'){
                const cb = (err, result) => {
                    if(err) {
                        finalCallback(err)
                    } else {
                        if(!result){
                            next(idx + 1)
                        } else {
                            finalCallback(null, result)
                        }
                    }
                }
                fn(...args, cb)
            }
        }
        next(0)
    }

    promise(...args){
        return new Promise((resolve, reject) => {
            const finalCallback = (err, result) => {
                if(err){
                    return reject(err)
                }
                resolve(result)
            }
            this.callAsync(...args, finalCallback)
        })
    }
}

// const testhook = new AsyncSeriesBailHook(['compilation', 'name'])
const testhook = new MyAsyncSeriesBailHook(['compilation', 'name'])


testhook.tap('plugin1', (name, compilation) => {
    console.log('plugin1', compilation, name)
    compilation.sum = compilation.sum + 1
    // const start = new Date().getTime();
    // while(new Date().getTime() - start < 2000){}
    // throw Error('plugin1抛出的error') // 错误被callAsync的第一个参数接收，或者promise的reject接收
    // return 'plugin1.result'; // 返回值有意义  callAsync的第二个参数接收，或者promise的resolve接收
})

testhook.tapPromise('plugin2', (name, compilation) => {
    return new Promise((resolve, reject) => {
        console.log('plugin2', compilation, name)
        setTimeout(() => {
            resolve();
            // resolve('plugin2.result')
            // reject('plugin2.error')
            compilation.sum = compilation.sum + 1
        }, 1000)
    })
})


testhook.tapAsync('plugin3', (name, compilation,cb) => {
    console.log('plugin3', compilation, name)
    setTimeout(() => {
        compilation.sum = compilation.sum + 4
        // cb();
        // cb(null, 'plugin3.result')
        // cb('plugin3.error', 'plugin3.result') // 第一个参数用来报告错误，传递给callAsync的第一个参数。第二个参数用于指示提前退出插件执行，并传递给callAsync的第二个参数
    }, 2000)
})


const compilation = { sum: 0 }
// 第一种方式：通过hook.callAsync调用
testhook.callAsync('Mike', compilation, function(err, result){ // 回调函数的参数用于接收错误信息
    console.log('执行完成', compilation)
    console.log('最终回调', err, result)
})

// 第二种方式：通过testhook.promise触发插件执行
// testhook.promise('Mike', compilation).then(res => {
//   console.log('最终回调', res) //
// }, err => {
//   console.log('有错误了。。。', err)
// })
console.log('最后的语句', compilation)
