import { app, logger } from './server.js'

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  logger.info(`🚀 KYC Council Backend running on port ${PORT}`)
})