const { AsyncSeriesLoopHook } = require('tapable')

/**
 * 特点：
 * 1. 异步串行循环钩子
 * 2. 通过testhook.tap注册的插件，返回值有意义，返回值如果不是undefined，那么将从第一个插件开始重新执行
 *    2.1 如果插件内部发生错误，则提前退出插件执行，并执行最终的回调函数，错误参数将传递给testhook.callAsync的最终回调函数的第一个参数，
 *    或者testhook.promise的reject参数
 * 3. 通过testhook.tapPromise注册的插件，如果promise的resolve(value)，value不是undefined，则从第一个插件开始重新执行。
 *    3.1 如果插件内部发生错误，则提前退出插件执行，并执行最终的回调函数，错误参数将传递给testhook.callAsync的最终回调函数的第一个参数
 *    3.2 如果promise调用了reject，则提前退出，执行最终的回调函数，并将错误传递给testhook.callAsync的最终回调函数的第一个参数，或者testhook.promise
 *    的reject参数
 * 4. 通过testhook.tapAsync(pluginName, (...args, cb) => {cb(err, result)})注册的插件，cb第一个参数用于报告错误，如果err有值，则插件退出，
 *    执行最终的回调函数。如果result有值且不是undefined，那么hook将会从第一个插件开始重新执行。
 * **/

class MyAsyncSeriesLoopHook{
    constructor(argNames){
        this._argNames = [];
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
                finalCallback();
                return;
            }
            const task = this.tasks[idx]
            const shouldNext = (result) => {
                if(result !== void 0){
                    next(0) // 从第一个开始重新执行
                } else {
                    next(idx + 1)
                }
            }
            if(task.type === 'sync'){
                shouldNext(task.fn(...args))
            }
            if(task.type === 'promise'){
                task.fn(...args).then(res => {
                    shouldNext(res)
                }, err => {
                    finalCallback(err)
                })
            }

            if(task.type === 'async'){
                const cb = (err, result) => {
                    if(err){
                        finalCallback(err)
                    } else {
                        shouldNext(result)
                    }
                }
                task.fn(...args, cb)
            }
        }

        next(0)
    }

    promise(...args){
        return new Promise((resolve, reject) => {
            const finalCallback = (err) => {
                if(err){
                    reject(err)
                } else {
                    resolve();
                }
            }
            this.callAsync(...args, finalCallback)
        })
    }
}


// const testhook = new AsyncSeriesLoopHook(['compilation', 'name'])
const testhook = new MyAsyncSeriesLoopHook(['compilation', 'name'])

let count1 = 2
let count2 = 2
let count3 = 2

testhook.tap('plugin1', (compilation, name) => {
    console.log('plugin1', count1, name)
    compilation.sum = compilation.sum + 1
    // const start = new Date().getTime();
    // while(new Date().getTime() - start < 2000){}
    // throw Error('plugin1抛出的error')
    count1--;
    if(count1 < 1) return;
    return count1; // 返回值有意义
})

testhook.tapPromise('plugin2', (compilation, name) => {
    return new Promise((resolve, reject) => {
        console.log('plugin2', count2, name)
        setTimeout(() => {
            if(count2<1){
                resolve()
            } else {
                resolve(count2)
            }
            count2--;
            // reject('plugin2.error')
        }, 1000)
        compilation.sum = compilation.sum + 1
    })
})


testhook.tapAsync('plugin3', (compilation, name,cb) => {
    console.log('plugin3', count3, name)
    compilation.sum = compilation.sum + 4
    setTimeout(() => {
        if(count3 < 1) {
            // cb('plugin3.error')
            cb()
        } else {
            cb(null, count3); // 第一个参数用来报告错误，第二个参数指示是否重新执行
        }
        count3--;
    }, 2000)
    return count3;
})



const compilation = { sum: 0 }
// 第一种方式：通过hook.callAsync调用
// testhook.callAsync(compilation, 'mike', function(err){ // 回调函数的参数用于接收错误信息
//     console.log('执行完成', compilation)
//     console.log('最终回调', err)
// })

// 第二种方式：通过testhook.promise触发插件执行
testhook.promise(compilation, 'name').then(res => {
    console.log('最终回调', res) // res永远为undefined
}, err => {
    console.log('有错误了。。。', err)
})
console.log('最后的语句', compilation)
