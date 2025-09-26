import fs from 'fs'
import path from 'path'

export const listDirectoryContents = async (dirPath: string): Promise<string[]> => {
    try {
        const contents = await fs.promises.readdir(dirPath)
        return contents
    } catch (error) {
        console.error('Error listing directory contents:', error)
        return []
    }
}

export const checkAndReadFile = async (dirPath: string, fileName: string): Promise<string | undefined> => {
    const filePath = path.join(dirPath, fileName)
    try {
        const content = await fs.promises.readFile(filePath, 'utf8')
        return content
    } catch (error) {
        return undefined
    }
}