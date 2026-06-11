/**
 * SOPHIA ELEGANCE STORE - BACKEND COMPLETO (Google Apps Script)
 * 
 * Este script cuida de TUDO: 
 * 1. Sincroniza seus Produtos e Estoque com a aba "Produtos" da planilha.
 * 2. Gera o Link Seguro do Bling para os clientes do site.
 */

const BLING_ACCESS_TOKEN = "COLE_AQUI_SEU_TOKEN_DO_BLING";
const SHEET_NAME = "Produtos";

// =======================================================
// RECEBE REQUISIÇÕES DE LEITURA DO SITE (VITRINE)
// =======================================================
function doGet(e) {
  try {
    const action = e.parameter.action;
    
    if (action === 'list') {
      const sheet = getOrCreateSheet();
      const data = sheet.getDataRange().getValues();
      const products = [];
      
      // Pula a primeira linha (cabeçalhos)
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row[0]) continue; // Pula linha vazia
        
        products.push({
          id: row[0],
          name: row[1],
          sku: row[2],
          cat: row[3],
          cost: parseFloat(row[4]) || 0,
          price: parseFloat(row[5]) || 0,
          salePrice: row[6] ? parseFloat(row[6]) : null,
          stock: parseStock(row[7]),
          status: row[8],
          featured: row[9],
          imgUrl: row[10] || '',
          cloudId: row[11] || '',
          blingId: row[12] || ''
        });
      }
      
      return jsonResponse({ success: true, products: products });
    }
    
    return jsonResponse({ success: false, error: "Ação GET não encontrada." });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// =======================================================
// RECEBE REQUISIÇÕES DE GRAVAÇÃO (PAINEL ADMIN E CHECKOUT)
// =======================================================
function doPost(e) {
  try {
    let requestData = {};
    if (e.postData && e.postData.contents) {
      requestData = JSON.parse(e.postData.contents);
    }
    
    // ── 1. GERAÇÃO DE LINK DO BLING (VITRINE) ──
    if (requestData.action === 'checkoutBling') {
      // Simulação: Quando preencher a API do Bling real, coloque a UrlFetchApp aqui
      const uniqueId = Math.floor(Math.random() * 1000000);
      const paymentLink = "https://pagamento.bling.com.br/pay/sophia/cart_" + uniqueId;
      return jsonResponse({ success: true, link: paymentLink });
    }
    
    // ── 2. SALVAR/CRIAR PRODUTO (PAINEL ADMIN) ──
    if (requestData.action === 'save') {
      const p = requestData.product;
      const sheet = getOrCreateSheet();
      const data = sheet.getDataRange().getValues();
      let rowIndex = -1;
      
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(p.id)) {
          rowIndex = i + 1; // +1 porque arrays começam em 0 e sheets em 1
          break;
        }
      }
      
      const rowData = [
        p.id, p.name, p.sku, p.cat, p.cost, p.price, p.salePrice || '', 
        JSON.stringify(p.stock), p.status, p.featured, p.imgUrl || '', p.cloudId || '', p.blingId || ''
      ];
      
      if (rowIndex > -1) {
        // Atualiza
        sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
      } else {
        // Cria novo
        sheet.appendRow(rowData);
      }
      return jsonResponse({ success: true });
    }
    
    // ── 3. ATUALIZAR ESTOQUE APÓS VENDA (PAINEL ADMIN) ──
    if (requestData.action === 'updateStock') {
      const sheet = getOrCreateSheet();
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(requestData.id)) {
          sheet.getRange(i + 1, 8).setValue(JSON.stringify(requestData.stock)); // Coluna H
          break;
        }
      }
      return jsonResponse({ success: true });
    }
    
    // ── 4. DELETAR PRODUTO (PAINEL ADMIN) ──
    if (requestData.action === 'delete') {
      const sheet = getOrCreateSheet();
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(requestData.id)) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
      return jsonResponse({ success: true });
    }
    
    return jsonResponse({ success: false, error: "Ação POST não reconhecida." });
    
  } catch (error) {
    return jsonResponse({ success: false, error: error.message });
  }
}

// =======================================================
// FUNÇÕES AUXILIARES
// =======================================================
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function parseStock(str) {
  try { return JSON.parse(str); } catch(e) { return {pp:0, p:0, m:0, g:0, gg:0}; }
}

function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // Configura os cabeçalhos na primeira vez
    sheet.appendRow([
      "ID", "Nome", "SKU", "Categoria", "Custo", "Preço", "Preço Promocional", 
      "Estoque (JSON)", "Status", "Destaque", "Imagem URL", "Cloud ID", "Bling ID"
    ]);
    sheet.getRange("A1:M1").setFontWeight("bold").setBackground("#f3f4f6");
  }
  return sheet;
}
