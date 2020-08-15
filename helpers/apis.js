const axios = require("axios")
module.exports = {

    serverNode: axios.create({
        baseURL: "http://localhost:3000"
    })

} 
