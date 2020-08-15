const { serverNode} = require("./apis")

class Worksheet {
    static async updateWorksheet(id, form) {

        try {
            await serverNode({
                method: "PUT",
                url: "/worksheets/" + id,
                data: form,
                // headers: {
                //     autho
                // }
            })

        } catch (error) {
            console.log(error.response.data)
        }

    }
}

module.exports = Worksheet