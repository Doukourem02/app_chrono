import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'

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
export const exportToExcel = (data: ExportData) => {
  // Créer un workbook
  const wb = XLSX.utils.book_new()
  
  // Créer une feuille avec les données
  const ws = XLSX.utils.aoa_to_sheet([
    [data.title],
    [`Exporté le ${new Date().toLocaleDateString('fr-FR')}`],
    [], // Ligne vide
    data.headers,
    ...data.rows,
  ])
  
  // Définir la largeur des colonnes
  const colWidths = data.headers.map((_, index) => {
    const maxLength = Math.max(
      data.headers[index].length,
      ...data.rows.map((row) => String(row[index] || '').length)
    )
    return { wch: Math.min(Math.max(maxLength + 2, 10), 50) }
  })
  ws['!cols'] = colWidths
  
  // Style du titre
  if (!ws['A1']) ws['A1'] = { t: 's', v: data.title }
  if (!ws['A1'].s) ws['A1'].s = {}
  ws['A1'].s.font = { bold: true, sz: 16 }
  
  // Ajouter la feuille au workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Données')
  
  // Nom du fichier
  const filename = data.filename || `${data.title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`
  
  // Télécharger
  XLSX.writeFile(wb, filename)
}

/**
 * Affiche un menu de sélection du format d'export
 */
export const showExportMenu = (data: ExportData, onSelect: (format: 'pdf' | 'excel') => void) => {
  // Créer un élément de menu déroulant
  const menu = document.createElement('div')
  menu.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    z-index: 10000;
    min-width: 300px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `
  
  const title = document.createElement('h3')
  title.textContent = 'Choisir le format d\'export'
  title.style.cssText = `
    margin: 0 0 20px 0;
    fontSize: 18px;
    fontWeight: 600;
    color: #111827;
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
    backgroundColor: #F3F4F6;
    color: #374151;
    border: none;
    fontSize: 14px;
    fontWeight: 600;
    cursor: pointer;
    marginTop: 8px;
    transition: background-color 0.2s;
  `
  cancelButton.onmouseover = () => {
    cancelButton.style.backgroundColor = '#E5E7EB'
  }
  cancelButton.onmouseout = () => {
    cancelButton.style.backgroundColor = '#F3F4F6'
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
      console.error('Erreur lors de l\'export PDF:', error)
      alert('Erreur lors de l\'export PDF. Veuillez réessayer.')
    })
  } else if (format === 'excel') {
    exportToExcel(data)
  } else {
    // Afficher le menu de sélection
    showExportMenu(data, (selectedFormat) => {
      if (selectedFormat === 'pdf') {
        exportToPDF(data).catch((error) => {
          console.error('Erreur lors de l\'export PDF:', error)
          alert('Erreur lors de l\'export PDF. Veuillez réessayer.')
        })
      } else {
        exportToExcel(data)
      }
    })
  }
}

