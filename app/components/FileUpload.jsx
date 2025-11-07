'use client'

import { useState, useRef } from 'react'
import { parseDMARCReport } from '../utils/dmarcParser'

export default function FileUpload({ onFilesUpload }) {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef(null)

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    processFiles(files)
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    processFiles(files)
  }

  const processFiles = async (files) => {
    setIsProcessing(true)
    const reports = []

    for (const file of files) {
      try {
        const text = await readFile(file)
        const report = parseDMARCReport(text, file.name)
        reports.push(report)
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error)
        alert(`Error processing ${file.name}: ${error.message}`)
      }
    }

    if (reports.length > 0) {
      onFilesUpload(reports)
    }

    setIsProcessing(false)

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const readFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        resolve(e.target.result)
      }

      reader.onerror = () => {
        reject(new Error('Failed to read file'))
      }

      reader.readAsText(file)
    })
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div
      className={`upload-area ${isDragging ? 'dragging' : ''} ${isProcessing ? 'processing' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xml"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      <svg
        className="upload-icon"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
      </svg>

      {isProcessing ? (
        <p className="upload-text">Processing files...</p>
      ) : (
        <>
          <p className="upload-text">Drop DMARC XML files here or click to browse</p>
          <p className="upload-subtext">You can upload multiple files at once</p>
        </>
      )}
    </div>
  )
}
