import { jsPDF } from 'jspdf'
import ExcelJS from 'exceljs'
import { logger } from './logger'

export interface ExportData {
  title: string
  headers: string[]
  rows: (string | number)[][]
  filename?: string
}

/**
 * Exporte des données en PDF
 */
export const exportToPDF = async (data: ExportData) => {
  // Import dynamique de jspdf-autotable
  const autoTableModule = await import('jspdf-autotable')
  const autoTable = autoTableModule.default || autoTableModule
  
  const doc = new jsPDF()
  
  // Titre
  doc.setFontSize(18)
  doc.text(data.title, 14, 20)
  
  // Date d'export
  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text(
    `Exporté le ${new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`,
    14,
    30
  )
  
  // Tableau
  autoTable(doc, {
    head: [data.headers],
    body: data.rows,
    startY: 40,
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [139, 92, 246], // #8B5CF6
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
  })
  
  // Nom du fichier
  const filename = data.filename || `${data.title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
  
  doc.save(filename)
}

/**
 * Exporte des données en Excel
 */
export const exportToExcel = async (data: ExportData) => {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Données')

  // Titre
  ws.addRow([data.title])
  ws.getCell('A1').font = { bold: true, size: 16 }

  // Date d'export
  ws.addRow([`Exporté le ${new Date().toLocaleDateString('fr-FR')}`])
  ws.addRow([])

  // En-têtes
  const headerRow = ws.addRow(data.headers)
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B5CF6' } }
  })

  // Données
  data.rows.forEach((row) => ws.addRow(row))

  // Largeur des colonnes
  data.headers.forEach((_, index) => {
    const maxLength = Math.max(
      data.headers[index].length,
      ...data.rows.map((row) => String(row[index] ?? '').length)
    )
    ws.getColumn(index + 1).width = Math.min(Math.max(maxLength + 2, 10), 50)
  })

  const filename = data.filename || `${data.title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Affiche un menu de sélection du format d'export
 */
export const showExportMenu = (data: ExportData, onSelect: (format: 'pdf' | 'excel') => void) => {
  // Détecter le thème actuel
  const isDarkMode = document.documentElement.classList.contains('dark')
  
  // Obtenir les couleurs depuis les CSS variables
  const getComputedColor = (variable: string) => {
    return getComputedStyle(document.documentElement).getPropertyValue(variable).trim()
  }
  
  const cardBg = isDarkMode 
    ? getComputedColor('--card-bg') || '#1e293b'
    : getComputedColor('--card-bg') || '#ffffff'
  const textPrimary = isDarkMode
    ? getComputedColor('--text-primary') || '#f1f5f9'
    : getComputedColor('--text-primary') || '#111827'
  const cardBorder = isDarkMode
    ? getComputedColor('--card-border') || '#334155'
    : getComputedColor('--card-border') || '#e5e7eb'
  const grayLight = isDarkMode
    ? getComputedColor('--gray-light') || '#334155'
    : getComputedColor('--gray-light') || '#f3f4f6'
  
  // Créer un élément de menu déroulant
  const menu = document.createElement('div')
  menu.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: ${cardBg};
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    z-index: 10000;
    min-width: 300px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    border: 1px solid ${cardBorder};
  `
  
  const title = document.createElement('h3')
  title.textContent = 'Choisir le format d\'export'
  title.style.cssText = `
    margin: 0 0 20px 0;
    fontSize: 18px;
    fontWeight: 600;
    color: ${textPrimary};
  `
  
  const buttonContainer = document.createElement('div')
  buttonContainer.style.cssText = `
    display: flex;
    flexDirection: column;
    gap: 12px;
  `
  
  const pdfButton = document.createElement('button')
  pdfButton.textContent = '📄 Exporter en PDF'
  pdfButton.style.cssText = `
    padding: 12px 20px;
    borderRadius: 8px;
    backgroundColor: #8B5CF6;
    color: white;
    border: none;
    fontSize: 14px;
    fontWeight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
  `
  pdfButton.onmouseover = () => {
    pdfButton.style.backgroundColor = '#7C3AED'
  }
  pdfButton.onmouseout = () => {
    pdfButton.style.backgroundColor = '#8B5CF6'
  }
  pdfButton.onclick = (e) => {
    e.stopPropagation()
    document.body.removeChild(overlay)
    onSelect('pdf')
  }
  
  const excelButton = document.createElement('button')
  excelButton.textContent = '📊 Exporter en Excel'
  excelButton.style.cssText = `
    padding: 12px 20px;
    borderRadius: 8px;
    backgroundColor: #10B981;
    color: white;
    border: none;
    fontSize: 14px;
    fontWeight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
  `
  excelButton.onmouseover = () => {
    excelButton.style.backgroundColor = '#059669'
  }
  excelButton.onmouseout = () => {
    excelButton.style.backgroundColor = '#10B981'
  }
  excelButton.onclick = (e) => {
    e.stopPropagation()
    document.body.removeChild(overlay)
    onSelect('excel')
  }
  
  const cancelButton = document.createElement('button')
  cancelButton.textContent = 'Annuler'
  cancelButton.style.cssText = `
    padding: 12px 20px;
    borderRadius: 8px;
    backgroundColor: ${grayLight};
    color: ${textPrimary};
    border: 1px solid ${cardBorder};
    fontSize: 14px;
    fontWeight: 600;
    cursor: pointer;
    marginTop: 8px;
    transition: background-color 0.2s;
  `
  cancelButton.onmouseover = () => {
    cancelButton.style.backgroundColor = isDarkMode ? '#475569' : '#E5E7EB'
  }
  cancelButton.onmouseout = () => {
    cancelButton.style.backgroundColor = grayLight
  }
  cancelButton.onclick = (e) => {
    e.stopPropagation()
    document.body.removeChild(overlay)
  }
  
  buttonContainer.appendChild(pdfButton)
  buttonContainer.appendChild(excelButton)
  buttonContainer.appendChild(cancelButton)
  
  menu.appendChild(title)
  menu.appendChild(buttonContainer)
  
  // Overlay pour fermer en cliquant à l'extérieur
  const overlay = document.createElement('div')
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9999;
  `
  overlay.onclick = () => {
    document.body.removeChild(overlay)
  }
  
  menu.onclick = (e) => {
    e.stopPropagation()
  }
  
  overlay.appendChild(menu)
  document.body.appendChild(overlay)
}

/**
 * Exporte des données en PDF et Excel avec un menu de sélection
 */
export const exportData = (data: ExportData, format?: 'pdf' | 'excel') => {
  if (format === 'pdf') {
    exportToPDF(data).catch((error) => {
      logger.error('Erreur lors de l\'export PDF:', error)
      alert('Erreur lors de l\'export PDF. Veuillez réessayer.')
    })
  } else if (format === 'excel') {
    exportToExcel(data).catch((error) => {
      logger.error('Erreur lors de l\'export Excel:', error)
      alert('Erreur lors de l\'export Excel. Veuillez réessayer.')
    })
  } else {
    // Afficher le menu de sélection
    showExportMenu(data, (selectedFormat) => {
      if (selectedFormat === 'pdf') {
        exportToPDF(data).catch((error) => {
          logger.error('Erreur lors de l\'export PDF:', error)
          alert('Erreur lors de l\'export PDF. Veuillez réessayer.')
        })
      } else {
        exportToExcel(data).catch((error) => {
          logger.error('Erreur lors de l\'export Excel:', error)
          alert('Erreur lors de l\'export Excel. Veuillez réessayer.')
        })
      }
    })
  }
}

