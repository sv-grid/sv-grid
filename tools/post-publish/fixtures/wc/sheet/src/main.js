// The documented npm path: a side-effect import registers <sv-sheet>.
import '@svgrid/enterprise/wc'

window.__check = { ready: false }
const sheet = document.getElementById('sheet')
sheet.data = [{ name: 'Budget', cells: [['Item', 'Amount'], ['Rent', '1200'], ['Food', '300'], ['Total', '=SUM(B2:B3)']] }]
sheet.addEventListener('ready', () => (window.__check.ready = true))
