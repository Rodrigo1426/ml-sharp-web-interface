import { useState, useEffect, useRef, useCallback } from 'react'
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d'
import './App.css'

const API_URL = 'http://localhost:5001/api'

function App() {
  const [imagePreview, setImagePreview] = useState(null)
  const [uploadedFilename, setUploadedFilename] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState('')
  const [plyFiles, setPlyFiles] = useState([])
  const [selectedPly, setSelectedPly] = useState('')
  const [isLoadingPly, setIsLoadingPly] = useState(false)
  const [error, setError] = useState(null)
  const [sceneInfo, setSceneInfo] = useState(null)
  
  const viewerContainerRef = useRef(null)
  const viewerRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    loadPlyFiles()
    return () => {
      if (viewerRef.current) viewerRef.current.dispose()
    }
  }, [])

  const loadPlyFiles = async () => {
    try {
      const response = await fetch(`${API_URL}/outputs`)
      const data = await response.json()
      setPlyFiles(data.files || [])
    } catch (err) {
      console.error('Erro ao carregar arquivos PLY:', err)
    }
  }

  const handleImageSelect = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setError(null)
    
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target.result)
    reader.readAsDataURL(file)

    const formData = new FormData()
    formData.append('image', file)

    try {
      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData
      })
      const data = await response.json()
      
      if (data.success) {
        setUploadedFilename(data.filename)
      } else {
        setError(data.error || 'Erro ao fazer upload')
      }
    } catch (err) {
      setError('Erro de conexão com o servidor')
    }
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)
      fileInputRef.current.files = dataTransfer.files
      handleImageSelect({ target: { files: dataTransfer.files } })
    }
  }, [])

  const handleDragOver = useCallback((e) => e.preventDefault(), [])

  const handleGenerate = async () => {
    if (!uploadedFilename) {
      setError('Primeiro faça upload de uma imagem')
      return
    }

    setIsGenerating(true)
    setGenerationProgress('Processando...')
    setError(null)

    try {
      const response = await fetch(`${API_URL}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: uploadedFilename })
      })

      const data = await response.json()

      if (data.success) {
        setGenerationProgress('Concluído!')
        await loadPlyFiles()
        if (data.ply_file) {
          setSelectedPly(data.ply_file)
          setTimeout(() => loadPlyViewer(data.ply_file), 500)
        }
      } else {
        setError(data.error || 'Erro ao gerar')
      }
    } catch (err) {
      setError('Erro de conexão com o servidor')
    } finally {
      setIsGenerating(false)
      setGenerationProgress('')
    }
  }

  const loadPlyViewer = async (plyPath) => {
    if (!plyPath || !viewerContainerRef.current) return

    setIsLoadingPly(true)
    setError(null)

    if (viewerRef.current) {
      viewerRef.current.dispose()
      viewerRef.current = null
    }
    viewerContainerRef.current.innerHTML = ''

    try {
      const viewer = new GaussianSplats3D.Viewer({
        cameraUp: [0, -1, 0],
        initialCameraPosition: [0, 0, -5],
        initialCameraLookAt: [0, 0, 0],
        rootElement: viewerContainerRef.current,
        sharedMemoryForWorkers: false
      })

      viewerRef.current = viewer

      await viewer.addSplatScene(`${API_URL}/ply/${plyPath}`, {
        splatAlphaRemovalThreshold: 5,
        showLoadingUI: true,
        progressiveLoad: true
      })

      viewer.start()
      setSceneInfo({ loaded: true, path: plyPath })
    } catch (err) {
      setError('Erro ao carregar o modelo 3D')
    } finally {
      setIsLoadingPly(false)
    }
  }

  const handlePlyChange = (e) => {
    const value = e.target.value
    setSelectedPly(value)
    if (value) loadPlyViewer(value)
  }

  const handleFullscreen = () => {
    viewerContainerRef.current?.requestFullscreen?.()
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Transform images into 3D Gaussian Splats</h1>
      </header>

      <main className="main-content">
        <div className="left-panel">
          <div 
            className="upload-area"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" className="image-preview" />
            ) : (
              <div className="upload-placeholder">
                <div className="upload-icon">📷</div>
                <p>Drop image here</p>
                <p className="upload-hint">or click to browse</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />
          </div>

          <button 
            className="generate-button"
            onClick={handleGenerate}
            disabled={!uploadedFilename || isGenerating}
          >
            {isGenerating ? generationProgress : 'Generate'}
          </button>

          {sceneInfo && (
            <div className="scene-info">
              1 scene • {(plyFiles.find(f => f.path === selectedPly)?.size_mb || 0).toFixed(1)} MB
            </div>
          )}

          {error && <div className="error-message">⚠️ {error}</div>}
        </div>

        <div className="right-panel">
          <div className="viewer-container">
            <div ref={viewerContainerRef} className="viewer-canvas">
              {!selectedPly && !isLoadingPly && (
                <div className="viewer-placeholder">
                  <div className="drop-zone">
                    <p className="drop-title">Drop PLY File</p>
                    <p className="drop-hint">or click anywhere to browse</p>
                  </div>
                </div>
              )}
              {isLoadingPly && (
                <div className="loading-overlay">
                  <div className="loading-spinner"></div>
                  <p>Loading...</p>
                </div>
              )}
            </div>
          </div>

          <select value={selectedPly} onChange={handlePlyChange} className="ply-dropdown">
            <option value="">Select a PLY file...</option>
            {plyFiles.map((file, i) => (
              <option key={i} value={file.path}>{file.name}</option>
            ))}
          </select>

          <button className="fullscreen-button" onClick={handleFullscreen} disabled={!selectedPly}>
            Open Fullscreen
          </button>
        </div>
      </main>
    </div>
  )
}

export default App
