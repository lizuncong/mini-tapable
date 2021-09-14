const { AsyncParallelHook } = require('tapable')

/**
 * 特点：
 * 1. 异步并行钩子。当所有插件执行完成，才会执行最终的回调函数
 * 2. 通过tap注册的插件，返回值没有意义。插件内部如果出错，则插件提前退出，则将错误传递给testhook.callAsync最终的回调函数的第一个参数，或者testhook.promise的reject
 * 3. 通过tapPromise注册的插件，resolve(value)，value的值没有意义。如果调用了reject，则执行最终的回调函数
 * 4. 通过tapAsync注册的插件，cb(value)中如果value不为undefined，则执行最终的回调函数或者promise.reject
 * **/

class MyAsyncParallelHook{
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
        let count = 0;
        this.tasks.forEach(task => {
            const fn = task.fn;
            if(task.type === 'sync'){
                count++;
                if(count === this.tasks.length){
                    finalCallback();
                }
                fn(...args)
            }
            if(task.type === 'promise'){
                fn(...args).then(res => {
                    count++;
                    if(count === this.tasks.length){
                        finalCallback();
                    }
                }, finalCallback)
            }
            if(task.type === 'async'){
                const cb = (err) => {
                    count++;
                    if(err){
                        finalCallback(err)
                    } else if(count === this.tasks.length) {
                        finalCallback();
                    }
                }
                fn(...args, cb)
            }
        })
    }

    promise(...args){
        return new Promise((resolve, reject) => {
            const finalCallback = (err) => {
                if(err){
                    reject(err)
                } else {
                    resolve()
                }
            }

            this.callAsync(...args, finalCallback)

        })
    }

}

const testhook = new AsyncParallelHook(['compilation', 'name'])
// const testhook = new MyAsyncParallelHook(['compilation', 'name'])

testhook.tap('plugin1', (name, compilation) => {
    console.log('plugin1', compilation, name)
    compilation.sum = compilation.sum + 1
    // const start = new Date().getTime();
    // while(new Date().getTime() - start < 2000){}
    // throw Error('plugin1抛出的error') // 错误被callAsync的第一个参数接收，或者promise的reject接收
    return 'plugin1.result'; // 返回值没有意义
})

testhook.tapPromise('plugin2', (name, compilation) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            console.log('plugin2', compilation, name)
            resolve('a');
            // reject('plugin2.error') // 调用reject则执行最后的回调函数，或者promise的reject
            compilation.sum = compilation.sum + 1
        }, 1000)
    })
})


testhook.tapAsync('plugin3', (name, compilation,cb) => {
    setTimeout(() => {
        console.log('plugin3', compilation, name)
        compilation.sum = compilation.sum + 4
        // cb();
        cb('plugin3.error') // 第一个参数用来报告错误，传递给callAsync的第一个参数。
    }, 2000)
})
const compilation = { sum: 0 }

// 第一种方式：通过hook.callAsync调用
// testhook.callAsync('Mike', compilation, function(err){ // 回调函数的参数用于接收错误信息
//     console.log('执行完成', compilation)
//     console.log('最终回调', err)
// })

// 第二种方式：通过testhook.promise触发插件执行
testhook.promise('Mike', compilation).then(res => {
  console.log('最终回调', res) //
}, err => {
  console.log('有错误了。。。', err)
})
console.log('最后的语句', compilation)
