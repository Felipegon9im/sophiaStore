/**
 * SOPHIA ELEGANCE STORE - BACKEND SUPABASE V1 (Google Apps Script + Supabase REST API)
 * 
 * INSTRUÇÕES:
 * 1. Cole este código no editor do Google Apps Script.
 * 2. Configure as propriedades de script SUPABASE_URL e SUPABASE_KEY no painel do GAS.
 * 3. Salve e clique em "Implantar" -> "Nova Implantação" -> "App da Web" (Acesso: Qualquer pessoa).
 */

function getSupabaseCredentials() {
  const scriptProperties = PropertiesService.getScriptProperties();
  let url = scriptProperties.getProperty('SUPABASE_URL');
  let key = scriptProperties.getProperty('SUPABASE_KEY');
  
  if (!url || !key) {
    url = "https://your-project.supabase.co";
    key = "your-anon-key";
  }
  return { url, key };
}

function getBlingClientCredentials() {
  const scriptProperties = PropertiesService.getScriptProperties();
  let clientId = scriptProperties.getProperty('BLING_CLIENT_ID');
  let clientSecret = scriptProperties.getProperty('BLING_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    clientId = "b015d7ca8bb61959404f87ecf4bd3d6445391fb4";
    clientSecret = "d5cbcbddb92b8ab45b273cd0262672ac3aab9d4e055a0f30f8f8c7115466";
  }
  return { clientId, clientSecret };
}

function registrarLog(acao, mensagem) {
  Logger.log("[" + acao + "] " + mensagem);
}

// ==========================================
// MÉTODOS HTTP (GET e POST)
// ==========================================

function doGet(e) {
  try {
    if (e.parameter.code) {
      const success = exchangeBlingCodeForToken(e.parameter.code);
      if (success) {
        return ContentService.createTextOutput("✅ Autorizado com sucesso! O seu painel agora está conectado ao Bling. Você pode fechar esta janela.");
      } else {
        return ContentService.createTextOutput("❌ Falha ao autorizar no Bling. Verifique os logs do Apps Script.");
      }
    }
    
    const action = e.parameter.action;
    if (action === 'list') {
      const creds = getSupabaseCredentials();
      const headers = {
        "apikey": creds.key,
        "Authorization": "Bearer " + creds.key
      };

      // Buscar produtos
      const resProducts = UrlFetchApp.fetch(creds.url + "/rest/v1/produtos?select=*", {
        "method": "GET",
        "headers": headers,
        "muteHttpExceptions": true
      });
      let rawProducts = [];
      try { rawProducts = JSON.parse(resProducts.getContentText()); } catch(_) {}

      const products = Array.isArray(rawProducts) ? rawProducts.map(p => ({
        id: p.id, name: p.name, sku: p.sku || '', cat: p.cat || '',
        cost: parseFloat(p.cost) || 0, price: parseFloat(p.price) || 0,
        salePrice: p.sale_price ? parseFloat(p.sale_price) : null,
        stock: typeof p.stock === 'string' ? JSON.parse(p.stock) : p.stock,
        status: p.status || 'Ativo', featured: p.featured ? "Sim" : "Não", imgUrl: p.img_url || '',
        cloudId: p.cloud_id || '', blingId: p.bling_id || ''
      })) : [];

      // Buscar categorias
      const resCategories = UrlFetchApp.fetch(creds.url + "/rest/v1/categorias?select=*&order=order.asc", {
        "method": "GET",
        "headers": headers,
        "muteHttpExceptions": true
      });
      let rawCategories = [];
      try { rawCategories = JSON.parse(resCategories.getContentText()); } catch(_) {}

      const categories = Array.isArray(rawCategories) ? rawCategories.map(c => ({
        id: c.id, name: c.name, desc: c.desc || '', 
        imgUrl: c.img_url || '', cloudId: c.cloud_id || '', order: parseInt(c.order) || 0
      })) : [];

      // Buscar pedidos
      const resOrders = UrlFetchApp.fetch(creds.url + "/rest/v1/pedidos?select=*&order=created_at.desc", {
        "method": "GET",
        "headers": headers,
        "muteHttpExceptions": true
      });
      let rawOrders = [];
      try { rawOrders = JSON.parse(resOrders.getContentText()); } catch(_) {}

      const orders = Array.isArray(rawOrders) ? rawOrders.map(o => ({
        id: o.id, customer: o.customer, products: o.products || '',
        total: parseFloat(o.total) || 0, payment: "Nuvem",
        status: o.status || 'Aberto', source: o.source || 'Bling ERP', date: o.created_at ? new Date(o.created_at).toLocaleDateString('pt-BR') : ''
      })) : [];

      return jsonResponse({ success: true, products: products, categories: categories, orders: orders });
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
      try {
        requestData = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        requestData = {}; 
      }
    }
    
    if (Object.keys(requestData).length === 0 && e.parameter && e.parameter.data) {
      try {
        requestData = { data: JSON.parse(e.parameter.data) };
      } catch (e2) {}
    }
    
    const creds = getSupabaseCredentials();
    const headers = {
      "apikey": creds.key,
      "Authorization": "Bearer " + creds.key,
      "Content-Type": "application/json"
    };

    // =====================================
    // 1. RECEBER WEBHOOKS DO BLING
    // =====================================
    if (requestData && requestData.data) {
      if (requestData.data.idProduto) {
        const idBling = requestData.data.idProduto;
        const novoEstoque = requestData.data.saldoVirtual || requestData.data.saldoFisico || 0;
        
        const resProd = UrlFetchApp.fetch(creds.url + "/rest/v1/produtos?select=*&bling_id=eq." + idBling, {
          "method": "GET",
          "headers": {
            "apikey": creds.key,
            "Authorization": "Bearer " + creds.key
          }
        });
        const matches = JSON.parse(resProd.getContentText());
        if (matches && matches.length > 0) {
          const prod = matches[0];
          let currentStock = prod.stock || {pp:0, p:0, m:0, g:0, gg:0};
          currentStock.m = novoEstoque;
          
          UrlFetchApp.fetch(creds.url + "/rest/v1/produtos?id=eq." + prod.id, {
            "method": "PATCH",
            "headers": headers,
            "payload": JSON.stringify({ "stock": currentStock }),
            "muteHttpExceptions": true
          });
        }
        
        registrarLog("Webhook Estoque", `Estoque do BlingID ${idBling} alterado para ${novoEstoque}`);
        return jsonResponse({ success: true, msg: "Webhook de estoque processado" });
      }
      
      else if (requestData.data.numero || requestData.data.situacao) {
        const d = requestData.data;
        const pId = d.id;
        const pNum = d.numero;
        const pTotal = d.total || 0;
        const pStatus = (d.situacao && d.situacao.id) ? "Bling Status " + d.situacao.id : "Aberto";
        
        let pOrigem = "Bling ERP"; 
        if (d.loja && d.loja.id) {
          const lojaId = String(d.loja.id);
          pOrigem = (lojaId === "206104156") ? "Shopee" : "Loja " + lojaId;
        }
        
        let fullItemsStr = "";
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
                fullItemsStr = fullOrder.itens.map(it => (it.quantidade||1) + "x " + (it.descricao||"Item")).join(", ");
              }
            }
          } catch(e) {}
        }
        
        const orderPayload = {
          "id": String(pId),
          "number": String(pNum),
          "customer": fetchedCustomer,
          "total": parseFloat(pTotal) || 0,
          "status": pStatus,
          "source": pOrigem,
          "products": fullItemsStr
        };
        
        UrlFetchApp.fetch(creds.url + "/rest/v1/pedidos", {
          "method": "POST",
          "headers": {
            ...headers,
            "Prefer": "resolution=merge-duplicates"
          },
          "payload": JSON.stringify(orderPayload),
          "muteHttpExceptions": true
        });
        
        registrarLog("Webhook Pedido", `Pedido ${pNum} de ${fetchedCustomer} processado.`);
        return jsonResponse({ success: true, msg: "Webhook de pedido processado" });
      }
    }
    
    // =====================================
    // 2. CHECKOUT BLING
    // =====================================
    if (requestData.action === 'checkoutBling') {
      const cart = requestData.cart;
      const total = requestData.total;
      
      const token = getValidBlingToken();
      if (!token) {
        return jsonResponse({ success: false, error: "Conexão Bling inativa. Configure no painel administrativo." });
      }
      
      const itensBling = cart.map(item => ({
        "codigo": item.sku || String(item.id),
        "descricao": item.name,
        "quantidade": item.qty,
        "valor": item.price,
        "unidade": "UN"
      }));
      
      const payloadPedido = {
        "contato": { "nome": "Cliente Vitrine Web" },
        "itens": itensBling,
        "parcelas": [{
          "valor": total,
          "dataVencimento": new Date(Date.now() + 86400000).toISOString().split('T')[0]
        }]
      };
      
      const resPedido = UrlFetchApp.fetch("https://api.bling.com.br/v3/pedidos/vendas", {
        "method": "POST",
        "headers": {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json",
          "Accept": "1.0"
        },
        "payload": JSON.stringify(payloadPedido),
        "muteHttpExceptions": true
      });
      
      const resText = resPedido.getContentText();
      const code = resPedido.getResponseCode();
      
      if (code === 201 || code === 200) {
        const orderData = JSON.parse(resText).data;
        const orderId = orderData.id;
        const orderNum = orderData.numero || "VT-" + Date.now().toString().slice(-6);
        
        const dbPayload = {
          "id": String(orderId),
          "number": String(orderNum),
          "customer": "Cliente Vitrine Web",
          "total": parseFloat(total),
          "status": "Aberto",
          "source": "Vitrine Web",
          "products": cart.map(i => i.qty + "x " + i.name).join(", ")
        };
        
        UrlFetchApp.fetch(creds.url + "/rest/v1/pedidos", {
          "method": "POST",
          "headers": {
            ...headers,
            "Prefer": "resolution=merge-duplicates"
          },
          "payload": JSON.stringify(dbPayload),
          "muteHttpExceptions": true
        });
        
        const paymentLink = "https://www.bling.com.br/receber/fatura/" + orderId;
        return jsonResponse({ success: true, checkoutUrl: paymentLink, orderId: orderId });
      } else {
        return jsonResponse({ success: false, error: "Erro ao gerar pedido no Bling: " + resText });
      }
    }
    
    return jsonResponse({ success: false, error: "Ação POST não suportada." });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// ==========================================
// MÉTODOS OAUTH E REFRESH BLING
// ==========================================

function getValidBlingToken() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const tokenExpiry = scriptProperties.getProperty('BLING_TOKEN_EXPIRY');
  
  if (tokenExpiry && parseInt(tokenExpiry) > Date.now()) {
    return scriptProperties.getProperty('BLING_ACCESS_TOKEN');
  }
  
  return refreshBlingToken();
}

function exchangeBlingCodeForToken(code) {
  try {
    const creds = getBlingClientCredentials();
    const tokenUrl = "https://www.bling.com.br/Api/v3/oauth/token";
    const basicAuth = Utilities.base64Encode(creds.clientId + ":" + creds.clientSecret);
    const payload = {
      "grant_type": "authorization_code",
      "code": code
    };
    
    const response = UrlFetchApp.fetch(tokenUrl, {
      "method": "POST",
      "headers": {
        "Authorization": "Basic " + basicAuth,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      "payload": payload,
      "muteHttpExceptions": true
    });
    
    const resText = response.getContentText();
    if (response.getResponseCode() === 200) {
      const data = JSON.parse(resText);
      salvarBlingTokens(data);
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

function refreshBlingToken() {
  try {
    const scriptProperties = PropertiesService.getScriptProperties();
    const refreshToken = scriptProperties.getProperty('BLING_REFRESH_TOKEN');
    if (!refreshToken) return null;
    
    const creds = getBlingClientCredentials();
    const tokenUrl = "https://www.bling.com.br/Api/v3/oauth/token";
    const basicAuth = Utilities.base64Encode(creds.clientId + ":" + creds.clientSecret);
    
    const payload = {
      "grant_type": "refresh_token",
      "refresh_token": refreshToken
    };
    
    const response = UrlFetchApp.fetch(tokenUrl, {
      "method": "POST",
      "headers": {
        "Authorization": "Basic " + basicAuth,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      "payload": payload,
      "muteHttpExceptions": true
    });
    
    const resText = response.getContentText();
    if (response.getResponseCode() === 200) {
      const data = JSON.parse(resText);
      salvarBlingTokens(data);
      return data.access_token;
    }
    return null;
  } catch (e) {
    return null;
  }
}

function salvarBlingTokens(data) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const expiryTime = Date.now() + (data.expires_in * 1000) - 60000;
  
  scriptProperties.setProperties({
    'BLING_ACCESS_TOKEN': data.access_token,
    'BLING_REFRESH_TOKEN': data.refresh_token,
    'BLING_TOKEN_EXPIRY': String(expiryTime)
  });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
