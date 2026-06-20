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
    url = "https://sfocvsknccuehrnoouox.supabase.co";
    key = "sb_publishable_GiCiYoNOMlpImpdQkKjVdg_8mZJhM1k";
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
        cloudId: p.cloud_id || '', blingId: p.bling_id || '',
        blingFormat: p.bling_format || 'S',
        blingType: p.bling_type || 'P',
        blingUnit: p.bling_unit || 'UN',
        blingCondition: p.bling_condition !== undefined ? parseInt(p.bling_condition) : 1,
        blingProduction: p.bling_production || 'P',
        blingExpiration: p.bling_expiration || '',
        blingFreeShipping: p.bling_free_shipping || false,
        blingGtinTributario: p.bling_gtin_tributario || '',
        blingVolumes: p.bling_volumes !== undefined ? parseInt(p.bling_volumes) : 1,
        blingItemsBox: p.bling_items_box !== undefined ? parseInt(p.bling_items_box) : 1,
        blingUnitMeasure: p.bling_unit_measure !== undefined ? parseInt(p.bling_unit_measure) : 2,
        blingCategoryId: p.bling_category_id || '',
        blingLinkExterno: p.bling_link_externo || '',
        blingVideoUrl: p.bling_video_url || '',
        blingDescShort: p.bling_desc_short || '',
        blingDescComp: p.bling_desc_comp || '',
        blingObservacoes: p.bling_observacoes || '',
        blingTags: p.bling_tags || '',
        brand: p.brand || '',
        desc: p.desc || '',
        gtin: p.gtin || '',
        weightNet: parseFloat(p.weight_net) || 0,
        weightGross: parseFloat(p.weight_gross) || 0,
        width: parseFloat(p.width) || 0,
        height: parseFloat(p.height) || 0,
        depth: parseFloat(p.depth) || 0
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
        imgUrl: c.img_url || '', cloudId: c.cloud_id || '', order: parseInt(c.order) || 0,
        type: c.type || 'adulto'
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
    
    // =====================================
    // 3. SINCRONIZAR PRODUTO NO BLING
    // =====================================
    if (requestData.action === 'syncBlingProduct') {
      const product = requestData.product;
      const blingRes = pushProductToBling(product);
      if (blingRes && blingRes.success) {
        return jsonResponse({ success: true, blingId: blingRes.data.id });
      } else {
        const errorMsg = (blingRes && blingRes.error) ? blingRes.error : "Falha desconhecida ao enviar produto ao Bling";
        return jsonResponse({ success: false, error: errorMsg });
      }
    }
    
    return jsonResponse({ success: false, error: "Ação POST não suportada." });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// Cria ou Atualiza produto no Bling V3
function pushProductToBling(product) {
  const token = getValidBlingToken();
  if (!token) return { success: false, error: "Token Bling inválido ou expirado." };
  
  const finalPrice = product.salePrice ? product.salePrice : product.price;
  
  const payload = {
    "nome": product.name,
    "codigo": product.sku || String(product.id),
    "preco": parseFloat(product.price) || 0,
    "tipo": product.blingType || "P",
    "situacao": product.status === "Ativo" ? "A" : "I",
    "formato": product.blingFormat || "S",
    "marca": product.brand || '',
    "unidade": product.blingUnit || 'UN',
    "condicao": !isNaN(parseInt(product.blingCondition)) ? parseInt(product.blingCondition) : 1,
    "tipoProducao": product.blingProduction || 'P',
    "freteGratis": !!product.blingFreeShipping,
    "pesoLiquido": parseFloat(product.weightNet) || 0,
    "pesoBruto": parseFloat(product.weightGross) || 0,
    "gtin": product.gtin || '',
    "gtinTributario": product.blingGtinTributario || '',
    "volumes": parseInt(product.blingVolumes) || 1,
    "itensPorCaixa": parseInt(product.blingItemsBox) || 1,
    "descricaoCurta": product.blingDescShort || product.desc || '',
    "descricaoComplementar": product.blingDescComp || product.desc || '',
    "linkExterno": product.blingLinkExterno || '',
    "observacoes": product.blingObservacoes || '',
    "dimensoes": {
      "largura": parseFloat(product.width) || 0,
      "altura": parseFloat(product.height) || 0,
      "profundidade": parseFloat(product.depth) || 0,
      "unidadeMedida": parseInt(product.blingUnitMeasure) || 2
    }
  };

  if (product.blingExpiration) {
    payload.dataValidade = product.blingExpiration;
  }

  if (product.blingTags) {
    payload.tags = product.blingTags.split(',').map(function(t) { return t.trim(); }).filter(function(t) { return t !== ''; });
  }

  if (product.blingCategoryId) {
    payload.categoria = {
      "id": parseInt(product.blingCategoryId)
    };
  }
  
  // Media handling (images and video)
  var hasImage = !!product.imgUrl;
  var hasVideo = !!product.blingVideoUrl;
  
  if (hasImage || hasVideo) {
    payload.midia = {
      "imagens": {
        "imagensURL": []
      },
      "video": {
        "url": product.blingVideoUrl || ""
      }
    };
    
    if (hasImage) {
      var finalImgUrl = product.imgUrl;
      if (finalImgUrl.toLowerCase().indexOf('.webp') > -1) {
        finalImgUrl = finalImgUrl.replace(/\.webp/gi, '.jpg');
      }
      payload.midia.imagens.imagensURL.push({
        "link": finalImgUrl
      });
    }
  }
  
  let url = "https://api.bling.com.br/v3/produtos";
  let method = "POST";
  
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
    const responseCode = response.getResponseCode();
    if (responseCode === 201 || responseCode === 200) {
      const data = JSON.parse(resText);
      const blingRes = data.data; // { id: 12345 }
      
      if (blingRes && blingRes.id) {
        // 1. Atualizar estoque físico total
        var totalStock = 0;
        if (product.stock) {
          for (var key in product.stock) {
            totalStock += (parseInt(product.stock[key]) || 0);
          }
        }
        updateBlingStock(blingRes.id, totalStock, token);
        
        // 2. Vincular com a Shopee
        linkProductToStore(blingRes.id, product, token);
      }
      
      return { success: true, data: blingRes };
    } else {
      Logger.log("Erro ao pushProductToBling: " + resText);
      return { success: false, error: "Bling API Error (Code " + responseCode + "): " + resText };
    }
  } catch (e) {
    Logger.log("Exception ao pushProductToBling: " + e.toString());
    return { success: false, error: e.toString() };
  }
}

// Obtém o primeiro depósito ativo no Bling
function getBlingDepositId(token) {
  const scriptProperties = PropertiesService.getScriptProperties();
  let depId = scriptProperties.getProperty('BLING_DEPOSITO_ID');
  if (depId) return depId;
  
  try {
    const res = UrlFetchApp.fetch("https://api.bling.com.br/v3/depositos?situacao=1", {
      "method": "GET",
      "headers": {
        "Authorization": "Bearer " + token,
        "Accept": "1.0"
      },
      "muteHttpExceptions": true
    });
    if (res.getResponseCode() === 200) {
      const data = JSON.parse(res.getContentText());
      if (data.data && data.data.length > 0) {
        depId = String(data.data[0].id);
        scriptProperties.setProperty('BLING_DEPOSITO_ID', depId);
        return depId;
      }
    }
  } catch(e) {
    Logger.log("Erro ao obter depósitos: " + e.toString());
  }
  return null;
}

// Sincroniza a quantidade física de estoque no Bling
function updateBlingStock(blingId, quantity, token) {
  const depositId = getBlingDepositId(token);
  if (!depositId) {
    Logger.log("Erro: Nenhum depósito encontrado no Bling para atualizar o estoque.");
    return false;
  }
  
  const payload = {
    "produto": { "id": parseInt(blingId) },
    "deposito": { "id": parseInt(depositId) },
    "operacao": "B", // Balanço (ajusta para o valor físico exato)
    "quantidade": parseFloat(quantity) || 0,
    "observacoes": "Sincronizado via Sophia Painel"
  };
  
  try {
    const response = UrlFetchApp.fetch("https://api.bling.com.br/v3/estoques", {
      "method": "POST",
      "headers": {
        "Authorization": "Bearer " + token,
        "Accept": "1.0",
        "Content-Type": "application/json"
      },
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    });
    if (response.getResponseCode() === 201 || response.getResponseCode() === 200) {
      Logger.log("Estoque atualizado no Bling com sucesso para " + quantity + " unidades.");
      return true;
    } else {
      Logger.log("Erro ao atualizar estoque no Bling: " + response.getContentText());
      return false;
    }
  } catch (e) {
    Logger.log("Exception ao atualizar estoque no Bling: " + e.toString());
    return false;
  }
}

// Vincula o produto à Shopee no Bling
function linkProductToStore(blingId, product, token) {
  const shopeeLojaId = "206104156"; // ID da integração Shopee 01
  const payload = {
    "produto": { "id": parseInt(blingId) },
    "loja": { "id": parseInt(shopeeLojaId) },
    "codigo": product.sku || String(product.id),
    "preco": parseFloat(product.price) || 0,
    "precoPromocional": product.salePrice ? parseFloat(product.salePrice) : null
  };
  
  try {
    const response = UrlFetchApp.fetch("https://api.bling.com.br/v3/produtos/lojas", {
      "method": "POST",
      "headers": {
        "Authorization": "Bearer " + token,
        "Accept": "1.0",
        "Content-Type": "application/json"
      },
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    });
    Logger.log("Vínculo Shopee realizado no Bling: " + response.getContentText());
  } catch (e) {
    Logger.log("Erro ao vincular produto com Shopee no Bling: " + e.toString());
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
