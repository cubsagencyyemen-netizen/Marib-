// Simple Express server skeleton for optional sync
const express = require('express')
const app = express()
app.use(express.json())

let store = []

app.get('/todos', (req, res) => {
  res.json(store)
})

app.post('/todos', (req, res) => {
  const data = req.body
  store = data
  res.json({ ok: true })
})

const port = process.env.PORT || 4000
app.listen(port, ()=> console.log('Server running on', port))
