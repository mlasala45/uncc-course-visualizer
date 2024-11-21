export default {
    moveTo: function (x: number, y: number) {
        return `M ${x} ${y}\n`
    },

    lineTo: function (x: number, y: number) {
        return `L ${x} ${y}\n`
    },

    arc: function (x: number, y: number, options: {
        rx: number,
        ry: number,
        xAxisRotation: number,
        largeArcFlag: boolean,
        sweepFlag: boolean
    }) {
        return `A ${options.rx} ${options.ry} ${options.xAxisRotation} ${Number(options.largeArcFlag)} ${Number(options.sweepFlag)} ${x} ${y}`
    }
}