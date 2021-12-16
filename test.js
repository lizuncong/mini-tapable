const { AsyncSeriesBailHook } = require('tapable')


const testhook = new AsyncSeriesBailHook(['compilation', 'name']);

testhook.tapAsync('plugin1', (name, compilation,cb) => {
    console.log('plugin1', compilation, name)
    setTimeout(() => {
        compilation.sum = compilation.sum + 4
        cb();
        // cb(null, 'plugin1.result', 'tewt')
        // cb('plugin3.error', 'plugin3.result') // 第一个参数用来报告错误，传递给callAsync的第一个参数。第二个参数用于指示提前退出插件执行，并传递给callAsync的第二个参数
    }, 2000)
})
testhook.tapAsync('plugin2', (name, compilation,cb) => {
    console.log('plugin2', compilation, name)
    setTimeout(() => {
        compilation.sum = compilation.sum + 4
        // cb();
        cb(null, 'plugin2.result')
        // cb('plugin3.error', 'plugin3.result') // 第一个参数用来报告错误，传递给callAsync的第一个参数。第二个参数用于指示提前退出插件执行，并传递给callAsync的第二个参数
    }, 2000)
})
testhook.tapAsync('plugin3', (name, compilation,cb) => {
    console.log('plugin3', compilation, name)
    setTimeout(() => {
        compilation.sum = compilation.sum + 4
        // cb();
        cb(null, 'plugin3.result')
        // cb('plugin3.error', 'plugin3.result') // 第一个参数用来报告错误，传递给callAsync的第一个参数。第二个参数用于指示提前退出插件执行，并传递给callAsync的第二个参数
    }, 2000)
})


const compilation = { sum: 0 }
// 第一种方式：通过hook.callAsync调用
testhook.callAsync('Mike', compilation, function(err, ...args){ // 回调函数的参数用于接收错误信息
    console.log('执行完成', compilation)
    console.log('最终回调', err, ...args)
})
