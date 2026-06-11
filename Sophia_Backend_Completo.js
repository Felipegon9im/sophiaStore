/**
 * SOPHIA ELEGANCE STORE - BACKEND COMPLETO V2 (Google Apps Script)
 * 
 * Este script cuida de TUDO: 
 * 1. Sincroniza Produtos e Categorias com a planilha.
 * 2. Gera o Link Seguro do Bling para os clientes do site.
 */

const BLING_ACCESS_TOKEN = "COLE_AQUI_SEU_TOKEN_DO_BLING";
const SHEET_PRODUTOS = "Produtos";
const SHEET_CATEGORIAS = "Categorias";

function doGet(e) {
  try {
    const action = e.parameter.action;
    
    if (action === 'list') {
      const pSheet = getOrCreateProductsSheet();
      const pData = pSheet.getDataRange().getValues();
      const products = [];
      for (let i = 1; i < pData.length; i++) {
        const row = pData[i];
        if (!row[0]) continue;
        products.push({
          id: row[0], name: row[1], sku: row[2], cat: row[3],
          cost: parseFloat(row[4]) || 0, price: parseFloat(row[5]) || 0,
          salePrice: row[6] ? parseFloat(row[6]) : null,
          stock: parseJSON(row[7], {pp:0, p:0, m:0, g:0, gg:0}),
          status: row[8], featured: row[9], imgUrl: row[10] || '',
          cloudId: row[11] || '', blingId: row[12] || ''
        });
      }

      const cSheet = getOrCreateCategoriesSheet();
      const cData = cSheet.getDataRange().getValues();
      const categories = [];
      for (let i = 1; i < cData.length; i++) {
        const row = cData[i];
        if (!row[0]) continue;
        categories.push({
          id: row[0], name: row[1], desc: row[2], 
          imgUrl: row[3] || '', cloudId: row[4] || '', order: parseInt(row[5]) || 0
        });
      }
      
      return jsonResponse({ success: true, products: products, categories: categories });
    }
    
    return jsonResponse({ success: false, error: "Ação GET não encontrada." });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function doPost(e) {
  try {
    let requestData = {};
    if (e.postData && e.postData.contents) {
      requestData = JSON.parse(e.postData.contents);
    }
    
    if (requestData.action === 'checkoutBling') {
      const uniqueId = Math.floor(Math.random() * 1000000);
      const paymentLink = "https://pagamento.bling.com.br/pay/sophia/cart_" + uniqueId;
      return jsonResponse({ success: true, link: paymentLink });
    }
    
    // PRODUTOS
    if (requestData.action === 'save') {
      const p = requestData.product;
      const sheet = getOrCreateProductsSheet();
      const data = sheet.getDataRange().getValues();
      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(p.id)) { rowIndex = i + 1; break; }
      }
      const rowData = [
        p.id, p.name, p.sku, p.cat, p.cost, p.price, p.salePrice || '', 
        JSON.stringify(p.stock), p.status, p.featured, p.imgUrl || '', p.cloudId || '', p.blingId || ''
      ];
      if (rowIndex > -1) sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
      else sheet.appendRow(rowData);
      return jsonResponse({ success: true });
    }
    
    if (requestData.action === 'updateStock') {
      const sheet = getOrCreateProductsSheet();
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(requestData.id)) {
          sheet.getRange(i + 1, 8).setValue(JSON.stringify(requestData.stock));
          break;
        }
      }
      return jsonResponse({ success: true });
    }
    
    if (requestData.action === 'delete') {
      const sheet = getOrCreateProductsSheet();
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(requestData.id)) { sheet.deleteRow(i + 1); break; }
      }
      return jsonResponse({ success: true });
    }

    // CATEGORIAS
    if (requestData.action === 'saveCategory') {
      const c = requestData.category;
      const sheet = getOrCreateCategoriesSheet();
      const data = sheet.getDataRange().getValues();
      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(c.id)) { rowIndex = i + 1; break; }
      }
      const rowData = [c.id, c.name, c.desc || '', c.imgUrl || '', c.cloudId || '', c.order || 0];
      if (rowIndex > -1) sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
      else sheet.appendRow(rowData);
      return jsonResponse({ success: true });
    }

    if (requestData.action === 'deleteCategory') {
      const sheet = getOrCreateCategoriesSheet();
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(requestData.id)) { sheet.deleteRow(i + 1); break; }
      }
      return jsonResponse({ success: true });
    }
    
    return jsonResponse({ success: false, error: "Ação POST não reconhecida." });
    
  } catch (error) {
    return jsonResponse({ success: false, error: error.message });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function parseJSON(str, def) {
  try { return JSON.parse(str); } catch(e) { return def; }
}

function getOrCreateProductsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_PRODUTOS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_PRODUTOS);
    sheet.appendRow(["ID", "Nome", "SKU", "Categoria", "Custo", "Preço", "Preço Promocional", "Estoque (JSON)", "Status", "Destaque", "Imagem URL", "Cloud ID", "Bling ID"]);
    sheet.getRange("A1:M1").setFontWeight("bold").setBackground("#f3f4f6");
  }
  return sheet;
}

function getOrCreateCategoriesSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_CATEGORIAS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_CATEGORIAS);
    sheet.appendRow(["ID", "Nome", "Descrição", "Imagem URL", "Cloud ID", "Ordem"]);
    sheet.getRange("A1:F1").setFontWeight("bold").setBackground("#e91e8c").setFontColor("white");
  }
  return sheet;
}
