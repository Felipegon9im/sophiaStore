/**
 * SOPHIA ELEGANCE STORE - BACKEND COMPLETO V3 (Google Apps Script + Bling V3)
 * 
 * INSTRUÇÕES:
 * 1. Cole este código no editor do Google Apps Script.
 * 2. Salve e clique em "Implantar" -> "Nova Implantação" -> "App da Web" (Acesso: Qualquer pessoa).
 * 3. Copie a URL do Web App (https://script.google.com/macros/s/.../exec).
 * 4. Cole essa URL no Bling no campo "URL de Retorno (Callback)".
 * 5. Volte aqui e acesse a URL do Bling para autorizar: https://www.bling.com.br/Api/v3/oauth/authorize?...
 */

function getBlingClientCredentials() {
  const scriptProperties = PropertiesService.getScriptProperties();
  let clientId = scriptProperties.getProperty('BLING_CLIENT_ID');
  let clientSecret = scriptProperties.getProperty('BLING_CLIENT_SECRET');
  
  // Fallback seguro caso as propriedades do Script ainda não estejam salvas no console do GAS
  if (!clientId || !clientSecret) {
    clientId = "b015d7ca8bb61959404f87ecf4bd3d6445391fb4";
    clientSecret = "d5cbcbddb92b8ab45b273cd0262672ac3aab9d4e055a0f30f8f8c7115466";
  }
  return { clientId, clientSecret };
}

const SHEET_PRODUTOS = "Produtos";
const SHEET_CATEGORIAS = "Categorias";
const SHEET_CONFIG = "Config";
const SHEET_PEDIDOS = "Pedidos";
const SHEET_LOGS = "Logs";

function registrarLog(acao, mensagem) {
  const sheet = getOrCreateSheet(SHEET_LOGS, ["Data", "Ação", "Mensagem"]);
  sheet.insertRowBefore(2);
  sheet.getRange(2, 1, 1, 3).setValues([[new Date(), acao, String(mensagem)]]);
}

// ==========================================
// MÉTODOS HTTP (GET e POST)
// ==========================================

function doGet(e) {
  try {
    // 1. Receber Código de Autorização do Bling (OAuth2 Callback)
    if (e.parameter.code) {
      const success = exchangeBlingCodeForToken(e.parameter.code);
      if (success) {
        return ContentService.createTextOutput("✅ Autorizado com sucesso! O seu painel agora está conectado ao Bling. Você pode fechar esta janela.");
      } else {
        return ContentService.createTextOutput("❌ Falha ao autorizar no Bling. Verifique os logs do Apps Script.");
      }
    }
    
    let rawGet = "";
    if (e.parameter) rawGet = JSON.stringify(e.parameter);
    if (!rawGet.includes('"action":"list"')) {
      registrarLog("DEBUG GET", `Requisição GET recebida: ${rawGet}`);
    }

    // 2. Listar Produtos para o Site
    const action = e.parameter.action;
    if (action === 'list') {
      const pSheet = getOrCreateSheet(SHEET_PRODUTOS, ["ID", "Nome", "SKU", "Categoria", "Custo", "Preço", "Preço Promocional", "Estoque (JSON)", "Status", "Destaque", "Imagem URL", "Cloud ID", "Bling ID"]);
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

      const cSheet = getOrCreateSheet(SHEET_CATEGORIAS, ["ID", "Nome", "Descrição", "Imagem URL", "Cloud ID", "Ordem"]);
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

      // 3. Listar Pedidos para o Site/Painel
      const oSheet = getOrCreateSheet(SHEET_PEDIDOS, ["ID", "Número", "Cliente", "Total", "Status", "Origem", "Itens", "Data"]);
      const oData = oSheet.getDataRange().getValues();
      const orders = [];
      for (let i = 1; i < oData.length; i++) {
        const row = oData[i];
        if (!row[0]) continue;
        
        let itemsStr = "Itens na Nuvem";
        try {
           let itArr = JSON.parse(row[6]);
           if (Array.isArray(itArr) && itArr.length > 0) {
              itemsStr = itArr.map(it => (it.quantidade||1) + "x " + (it.descricao||"Item")).join(", ");
           }
        } catch(e) {}
        
        let dateStr = row[7] ? new Date(row[7]).toLocaleDateString('pt-BR') : "";
        
        orders.push({
          id: row[1] || row[0], 
          customer: row[2] || "Desconhecido", 
          products: itemsStr,
          total: parseFloat(row[3]) || 0,
          payment: "Nuvem",
          status: row[4] || "Aberto", 
          source: row[5] || "Bling ERP", 
          date: dateStr
        });
      }

      return jsonResponse({ success: true, products: products, categories: categories, orders: orders });
    }
    
    return jsonResponse({ success: false, error: "Ação GET não encontrada." });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

function doPost(e) {
  try {
    // Debug absoluto: Loga tudo o que chega, seja JSON ou Form Data
    let rawPayload = "";
    if (e.postData && e.postData.contents) rawPayload += "CONTENTS: " + e.postData.contents + " | ";
    if (e.parameter) rawPayload += "PARAM: " + JSON.stringify(e.parameter);
    
    // Só loga se não for uma requisição interna de listar/salvar para não poluir
    if (rawPayload && !rawPayload.includes('"action":"save"')) {
      registrarLog("DEBUG INICIAL", rawPayload);
    }

    let requestData = {};
    if (e.postData && e.postData.contents) {
      try {
        requestData = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        requestData = {}; 
      }
    }
    
    // Se o Bling mandou como form-data (application/x-www-form-urlencoded) em V3
    if (Object.keys(requestData).length === 0 && e.parameter && e.parameter.data) {
      try {
        requestData = { data: JSON.parse(e.parameter.data) };
      } catch (e2) {}
    }
    
    // =====================================
    // 1. RECEBER WEBHOOKS DO BLING (Estoque e Pedidos)
    // =====================================
    if (requestData && requestData.data) {
      // Se for Estoque
      if (requestData.data.idProduto) {
        const idBling = requestData.data.idProduto;
        const novoEstoque = requestData.data.saldoVirtual || requestData.data.saldoFisico || 0;
        
        const sheet = getOrCreateSheet(SHEET_PRODUTOS, []);
        const data = sheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][12]) === String(idBling)) { 
            let currentStock = parseJSON(data[i][7], {pp:0, p:0, m:novoEstoque, g:0, gg:0});
            sheet.getRange(i + 1, 8).setValue(JSON.stringify(currentStock));
            break;
          }
        }
        registrarLog("Webhook Estoque", `Estoque do BlingID ${idBling} alterado para ${novoEstoque}`);
        return jsonResponse({ success: true, msg: "Webhook de estoque processado" });
      }
      
      // Se for Pedido
      else if (requestData.data.numero || requestData.data.situacao) {
        const d = requestData.data;
        const pId = d.id;
        const pNum = d.numero;
        const pCliente = (d.contato && d.contato.nome) ? d.contato.nome : "Desconhecido";
        const pTotal = d.total || 0;
        const pStatus = (d.situacao && d.situacao.id) ? "Bling Status " + d.situacao.id : "Aberto";
        
        let pOrigem = "Bling ERP"; 
        if (d.loja && d.loja.id) {
          const lojaId = String(d.loja.id);
          if (lojaId === "206104156") {
            pOrigem = "Shopee";
          } else {
            pOrigem = "Loja " + lojaId;
          }
        }
        
        const oSheet = getOrCreateSheet(SHEET_PEDIDOS, ["ID", "Número", "Cliente", "Total", "Status", "Origem", "Itens", "Data"]);
        const oData = oSheet.getDataRange().getValues();
        let found = false;
        let rIndex = -1;
        
        for (let i = 1; i < oData.length; i++) {
          if (String(oData[i][0]) === String(pId)) { rIndex = i + 1; found = true; break; }
        }
        
        // Busca dados completos do pedido na API do Bling para ter Itens e Nome do Cliente
        let fullItemsStr = "[]";
        let fetchedCustomer = "Desconhecido";
        
        const token = getValidBlingToken();
        if (token) {
          try {
            const res = UrlFetchApp.fetch("https://api.bling.com.br/v3/pedidos/vendas/" + pId, {
              "method": "GET",
              "headers": { "Authorization": "Bearer " + token, "Accept": "1.0" },
              "muteHttpExceptions": true
            });
            if (res.getResponseCode() === 200) {
              const fullOrder = JSON.parse(res.getContentText()).data;
              if (fullOrder.contato && fullOrder.contato.nome) {
                fetchedCustomer = fullOrder.contato.nome;
              }
              if (fullOrder.itens && Array.isArray(fullOrder.itens)) {
                fullItemsStr = JSON.stringify(fullOrder.itens);
              }
            }
          } catch(e) {
            registrarLog("Aviso API", "Falha ao buscar detalhes do pedido " + pId + ": " + e.toString());
          }
        }
        
        const rowData = [pId, pNum, fetchedCustomer, pTotal, pStatus, pOrigem, fullItemsStr, new Date()];
        if (found) oSheet.getRange(rIndex, 1, 1, rowData.length).setValues([rowData]);
        else oSheet.appendRow(rowData);
        
        registrarLog("Webhook Pedido", `Pedido ${pNum} (${pOrigem}) de ${fetchedCustomer} processado e detalhes baixados.`);
        return jsonResponse({ success: true, msg: "Webhook de pedido processado" });
      } else {
        // Fallback: Se chegou um webhook mas não é nem estoque nem pedido no formato esperado
        registrarLog("Webhook Recebido", `Formato desconhecido: ${JSON.stringify(requestData)}`);
        return jsonResponse({ success: true, msg: "Webhook recebido mas formato desconhecido" });
      }
    } else if (requestData && Object.keys(requestData).length > 0 && !requestData.action) {
      // Outro formato de webhook que não tem 'data' (talvez Bling V2)
      registrarLog("Webhook Bruto", `Payload: ${JSON.stringify(requestData)}`);
      return jsonResponse({ success: true, msg: "Webhook genérico logado" });
    }
    
    // =====================================
    // 2. REQUISIÇÕES DO PAINEL ADMIN
    // =====================================
    // LOTE: Salvar múltiplos produtos em lote
    if (requestData.action === 'saveBatch') {
      const productsList = requestData.products;
      const sheet = getOrCreateSheet(SHEET_PRODUTOS, []);
      const data = sheet.getDataRange().getValues();
      const updatedBlingIds = [];

      for (const p of productsList) {
        let rowIndex = -1;
        let existingBlingId = '';
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][0]) === String(p.id)) {
            rowIndex = i + 1;
            existingBlingId = data[i][12];
            break;
          }
        }
        
        p.blingId = p.blingId || existingBlingId;
        const blingRes = pushProductToBling(p);
        if (blingRes && blingRes.id) {
          p.blingId = blingRes.id;
        }

        const rowData = [
          p.id, p.name, p.sku, p.cat, p.cost, p.price, p.salePrice || '',
          JSON.stringify(p.stock), p.status, p.featured, p.imgUrl || '', p.cloudId || '', p.blingId || ''
        ];

        if (rowIndex > -1) {
          sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
        } else {
          sheet.appendRow(rowData);
        }
        updatedBlingIds.push({ id: p.id, blingId: p.blingId });
      }

      return jsonResponse({ success: true, updatedBlingIds });
    }

    if (requestData.action === 'save') {
      const p = requestData.product;
      const sheet = getOrCreateSheet(SHEET_PRODUTOS, []);
      const data = sheet.getDataRange().getValues();
      let rowIndex = -1;
      let existingBlingId = '';
      
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(p.id)) { 
          rowIndex = i + 1; 
          existingBlingId = data[i][12];
          break; 
        }
      }
      
      // Envia Produto pro Bling V3
      p.blingId = p.blingId || existingBlingId;
      const blingRes = pushProductToBling(p);
      if (blingRes && blingRes.id) {
        p.blingId = blingRes.id; // Atualiza com o ID retornado do Bling
        registrarLog("Sucesso Bling", `Produto '${p.name}' enviado com sucesso (ID: ${p.blingId})`);
      } else if (blingRes && !blingRes.id) {
        registrarLog("Erro Bling", `Falha ao enviar produto '${p.name}': ${JSON.stringify(blingRes)}`);
      }

      const rowData = [
        p.id, p.name, p.sku, p.cat, p.cost, p.price, p.salePrice || '', 
        JSON.stringify(p.stock), p.status, p.featured, p.imgUrl || '', p.cloudId || '', p.blingId || ''
      ];
      
      if (rowIndex > -1) sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
      else sheet.appendRow(rowData);
      
      return jsonResponse({ success: true, blingId: p.blingId });
    }
    
    if (requestData.action === 'delete') {
      const sheet = getOrCreateSheet(SHEET_PRODUTOS, []);
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(requestData.id)) { sheet.deleteRow(i + 1); break; }
      }
      return jsonResponse({ success: true });
    }

    // CATEGORIAS
    if (requestData.action === 'saveCategory') {
      const c = requestData.category;
      const sheet = getOrCreateSheet(SHEET_CATEGORIAS, []);
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
      const sheet = getOrCreateSheet(SHEET_CATEGORIAS, []);
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

// ==========================================
// FUNÇÕES DO BLING (OAuth2 & Integração API V3)
// ==========================================

function getBlingAuthHeaders() {
  const creds = getBlingClientCredentials();
  const credentials = creds.clientId + ":" + creds.clientSecret;
  return "Basic " + Utilities.base64Encode(credentials);
}

// Troca o código gerado na URL por um Token de Acesso válido
function exchangeBlingCodeForToken(code) {
  const url = "https://www.bling.com.br/Api/v3/oauth/token";
  const payload = {
    "grant_type": "authorization_code",
    "code": code
  };
  
  try {
    const response = UrlFetchApp.fetch(url, {
      "method": "POST",
      "headers": {
        "Authorization": getBlingAuthHeaders(),
        "Accept": "1.0"
      },
      "payload": payload,
      "muteHttpExceptions": true
    });
    
    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());
      saveBlingTokens(data.access_token, data.refresh_token, data.expires_in);
      return true;
    } else {
      Logger.log("Erro no exchangeBlingCodeForToken: " + response.getContentText());
      return false;
    }
  } catch (e) {
    Logger.log("Exception no exchangeBlingCodeForToken: " + e.toString());
    return false;
  }
}

// Usa o Refresh Token para pegar um novo Access Token
function refreshBlingToken(refreshToken) {
  const url = "https://www.bling.com.br/Api/v3/oauth/token";
  const payload = {
    "grant_type": "refresh_token",
    "refresh_token": refreshToken
  };
  
  try {
    const response = UrlFetchApp.fetch(url, {
      "method": "POST",
      "headers": {
        "Authorization": getBlingAuthHeaders(),
        "Accept": "1.0"
      },
      "payload": payload,
      "muteHttpExceptions": true
    });
    
    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());
      saveBlingTokens(data.access_token, data.refresh_token, data.expires_in);
      return data.access_token;
    } else {
      Logger.log("Erro no refreshBlingToken: " + response.getContentText());
      return null;
    }
  } catch (e) {
    return null;
  }
}

function getValidBlingToken() {
  const sheet = getOrCreateSheet(SHEET_CONFIG, ["CHAVE", "VALOR"]);
  const data = sheet.getDataRange().getValues();
  let accessToken = "";
  let refreshToken = "";
  let expiresAt = 0;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === "bling_access_token") accessToken = data[i][1];
    if (data[i][0] === "bling_refresh_token") refreshToken = data[i][1];
    if (data[i][0] === "bling_expires_at") expiresAt = parseInt(data[i][1]);
  }
  
  if (!accessToken) return null; // Nunca autorizou
  
  const now = new Date().getTime();
  // Se faltar menos de 5 minutos para expirar, renova
  if (now >= (expiresAt - 300000) && refreshToken) {
    return refreshBlingToken(refreshToken);
  }
  
  return accessToken;
}

function saveBlingTokens(access, refresh, expiresInSeconds) {
  const sheet = getOrCreateSheet(SHEET_CONFIG, ["CHAVE", "VALOR"]);
  const now = new Date().getTime();
  const expiresAt = now + (expiresInSeconds * 1000);
  
  updateConfigValue(sheet, "bling_access_token", access);
  updateConfigValue(sheet, "bling_refresh_token", refresh);
  updateConfigValue(sheet, "bling_expires_at", expiresAt.toString());
}

function updateConfigValue(sheet, key, value) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

// Cria ou Atualiza produto no Bling V3
function pushProductToBling(product) {
  const token = getValidBlingToken();
  if (!token) return null; // Sem autorização, ignora envio pro Bling
  
  // Calcula preço a ser enviado (Sale Price ou Price)
  const finalPrice = product.salePrice ? product.salePrice : product.price;
  
  const payload = {
    "nome": product.name,
    "codigo": product.sku || product.id,
    "preco": finalPrice,
    "tipo": "P",
    "situacao": product.status === "Ativo" ? "A" : "I",
    "formato": "S"
  };
  
  var url = "https://api.bling.com.br/v3/produtos";
  let method = "POST";
  
  // Se já tiver o ID do Bling salvo na planilha, é atualização
  if (product.blingId) {
    url += "/" + product.blingId;
    method = "PUT";
  }
  
  try {
    const response = UrlFetchApp.fetch(url, {
      "method": method,
      "headers": {
        "Authorization": "Bearer " + token,
        "Accept": "1.0",
        "Content-Type": "application/json"
      },
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    });
    
    const resText = response.getContentText();
    if (response.getResponseCode() === 201 || response.getResponseCode() === 200) {
      const data = JSON.parse(resText);
      return data.data; // Retorna o objeto criado { id: 12345 }
    } else {
      Logger.log("Erro ao pushProductToBling: " + resText);
      return null;
    }
  } catch (e) {
    Logger.log("Exception ao pushProductToBling: " + e.toString());
    return null;
  }
}

// ==========================================
// UTILITÁRIOS
// ==========================================

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function parseJSON(str, def) {
  try { return JSON.parse(str); } catch(e) { return def; }
}

function getOrCreateSheet(sheetName, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#f3f4f6");
    }
  }
  return sheet;
}
