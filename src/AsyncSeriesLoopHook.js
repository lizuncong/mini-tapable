const { AsyncSeriesLoopHook } = require('tapable')

/**
 * 特点：
 * 1. 异步串行循环钩子
 * 2. 通过testhook.tap注册的插件，返回值有意义，返回值如果不是undefined，那么将从第一个插件开始重新执行
 *    2.1 如果插件内部发生错误，则提前退出插件执行，并执行最终的回调函数，错误参数将传递给testhook.callAsync的最终回调函数的第一个参数
 * 3. 通过testhook.tapPromise注册的插件，如果promise的resolve(value)，value不是undefined，则从第一个插件开始重新执行。
 *    3.1 如果插件内部发生错误，则提前退出插件执行，并执行最终的回调函数，错误参数将传递给testhook.callAsync的最终回调函数的第一个参数
 *    3.2 如果promise调用了reject，则提前退出，执行最终的回调函数，并将错误传递给testhook.callAsync的最终回调函数的第一个参数
 * **/
const testhook = new AsyncSeriesLoopHook(['compilation', 'name'])

let count1 = 2
let count2 = 2
let count3 = 2

testhook.tap('plugin1', (compilation, name) => {
    console.log('plugin1', name)
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
        console.log('plugin2', name)
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
    console.log('plugin3', name)
    compilation.sum = compilation.sum + 4
    setTimeout(() => {
        if(count3 < 1) {
            cb()
        } else {
            cb(null, count3);
        }
    }, 2000)
    return count3;
})



const compilation = { sum: 0 }
// 第一种方式：通过hook.callAsync调用
testhook.callAsync(compilation, 'mike', function(...args){
    console.log('执行完成', compilation)
    console.log('最终回调', args)
})

// 第二种方式：通过testhook.promise触发插件执行
// testhook.promise(compilation, 'name').then(res => {
//     console.log('最终回调', res)
// }, err => {
//     console.log('有错误了。。。', err)
// })
console.log('最后的语句', compilation)
