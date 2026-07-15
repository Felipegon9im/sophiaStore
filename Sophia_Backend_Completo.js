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
        const skuBling = requestData.data.codigo || "";
        const novoEstoque = requestData.data.saldoVirtual || requestData.data.saldoFisico || 0;
        
        let resProd = UrlFetchApp.fetch(creds.url + "/rest/v1/produtos?select=*&bling_id=eq." + idBling, {
          "method": "GET",
          "headers": {
            "apikey": creds.key,
            "Authorization": "Bearer " + creds.key
          }
        });
        let matches = JSON.parse(resProd.getContentText());
        
        if ((!matches || matches.length === 0) && skuBling) {
          const resAll = UrlFetchApp.fetch(creds.url + "/rest/v1/produtos?select=*", {
            "method": "GET",
            "headers": {
              "apikey": creds.key,
              "Authorization": "Bearer " + creds.key
            }
          });
          const allProds = JSON.parse(resAll.getContentText());
          matches = allProds.filter(function(p) {
            return p.sku && skuBling.startsWith(p.sku);
          });
        }
        
        if (matches && matches.length > 0) {
          const prod = matches[0];
          let currentStock = prod.stock || {};
          if (typeof currentStock === 'string') {
            try { currentStock = JSON.parse(currentStock); } catch(_) { currentStock = {}; }
          }
          
          var isColor = false;
          for (var sz in currentStock) {
            if (currentStock[sz] && typeof currentStock[sz] === 'object') {
              isColor = true;
              break;
            }
          }
          
          if (skuBling && prod.sku && skuBling.length > prod.sku.length) {
            var suffix = skuBling.substring(prod.sku.length);
            var parts = suffix.split('-').filter(Boolean);
            if (parts.length >= 2) {
              var colorName = parts[0].toUpperCase();
              var sizeName = parts[1].toLowerCase();
              
              var sizeVal = currentStock[sizeName];
              if (sizeVal && typeof sizeVal === 'object') {
                var matchedColorKey = null;
                for (var key in sizeVal) {
                  if (key.toUpperCase() === colorName) {
                    matchedColorKey = key;
                    break;
                  }
                }
                if (!matchedColorKey) {
                  matchedColorKey = colorName === "PADRAO" ? "" : parts[0];
                }
                
                if (matchedColorKey === "" && sizeVal[""] !== undefined) {
                  currentStock[sizeName][""] = parseInt(novoEstoque) || 0;
                } else {
                  currentStock[sizeName][matchedColorKey] = parseInt(novoEstoque) || 0;
                }
              } else {
                currentStock[sizeName] = parseInt(novoEstoque) || 0;
              }
            } else if (parts.length === 1) {
              var sizeName = parts[0].toLowerCase();
              currentStock[sizeName] = parseInt(novoEstoque) || 0;
            }
          } else {
            var keys = Object.keys(currentStock);
            if (keys.length === 1) {
              currentStock[keys[0]] = parseInt(novoEstoque) || 0;
            } else if (currentStock.unico !== undefined) {
              currentStock.unico = parseInt(novoEstoque) || 0;
            } else {
              currentStock.m = parseInt(novoEstoque) || 0;
            }
          }
          
          UrlFetchApp.fetch(creds.url + "/rest/v1/produtos?id=eq." + prod.id, {
            "method": "PATCH",
            "headers": headers,
            "payload": JSON.stringify({ "stock": currentStock }),
            "muteHttpExceptions": true
          });
        }
        
        registrarLog("Webhook Estoque", `Estoque do BlingID ${idBling} (SKU: ${skuBling}) alterado para ${novoEstoque}`);
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
    
    if (requestData.action === 'testStockUpdate') {
      const blingId = requestData.blingId;
      const quantity = requestData.quantity;
      const token = getValidBlingToken();
      
      const depositId = getBlingDepositId(token);
      if (!depositId) {
        return jsonResponse({ success: false, error: "Nenhum depósito encontrado no Bling." });
      }
      
      const payload = {
        "produto": { "id": parseInt(blingId) },
        "deposito": { "id": parseInt(depositId) },
        "operacao": "B",
        "quantidade": parseFloat(quantity) || 0,
        "observacoes": "Sincronizado via Sophia Painel (Test)"
      };
      
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
      
      return jsonResponse({
        success: response.getResponseCode() === 200 || response.getResponseCode() === 201,
        code: response.getResponseCode(),
        depositId: depositId,
        body: response.getContentText()
      });
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

    if (requestData.action === 'fillProductWithAI') {
      const name = requestData.name;
      const categoriesList = requestData.categoriesList || [];
      const aiRes = generateProductDetailsWithAI(name, categoriesList, requestData.apiKey);
      return jsonResponse(aiRes);
    }

    if (requestData.action === 'importBlingProducts') {
      const existingBlingIds = requestData.existingBlingIds || [];
      const importRes = importBlingProductsToSupabase(existingBlingIds);
      return jsonResponse(importRes);
    }

    // =====================================
    // 4. OBTER CANAIS DE VENDA DO BLING
    // =====================================
    if (requestData.action === 'getBlingChannels') {
      const token = getValidBlingToken();
      if (!token) return jsonResponse({ success: false, error: "Token Bling inválido ou expirado." });
      
      const response = UrlFetchApp.fetch("https://api.bling.com.br/v3/canais-venda", {
        "method": "GET",
        "headers": {
          "Authorization": "Bearer " + token,
          "Accept": "application/json"
        },
        "muteHttpExceptions": true
      });
      
      const resCode = response.getResponseCode();
      const resText = response.getContentText();
      
      if (resCode === 200) {
        const data = JSON.parse(resText);
        return jsonResponse({ success: true, data: data.data || [] });
      } else {
        return jsonResponse({ success: false, error: "Erro Bling API (" + resCode + "): " + resText });
      }
    }

    // =====================================
    // 5. EXPORTAR PRODUTO PARA CANAL
    // =====================================
    if (requestData.action === 'exportProductToBlingChannel') {
      const token = getValidBlingToken();
      if (!token) return jsonResponse({ success: false, error: "Token Bling inválido ou expirado." });
      
      let payload = {
        "produto": {
          "id": parseInt(requestData.blingProductId)
        },
        "loja": {
          "id": parseInt(requestData.channelId)
        },
        "codigo": requestData.sku || "",
        "preco": {
          "preco": parseFloat(requestData.price) || 0
        }
      };
      
      if (requestData.salePrice) {
        payload.preco.precoPromocional = parseFloat(requestData.salePrice);
      }
      
      let response = UrlFetchApp.fetch("https://api.bling.com.br/v3/produtos/lojas", {
        "method": "POST",
        "headers": {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        "payload": JSON.stringify(payload),
        "muteHttpExceptions": true
      });
      
      let resCode = response.getResponseCode();
      let resText = response.getContentText();
      
      // Se falhar, tenta com a estrutura Flat (idProduto / idLoja)
      if (resCode !== 200 && resCode !== 201) {
        const payloadFlat = {
          "idProduto": parseInt(requestData.blingProductId),
          "idLoja": parseInt(requestData.channelId),
          "codigo": requestData.sku || "",
          "preco": parseFloat(requestData.price) || 0
        };
        if (requestData.salePrice) {
          payloadFlat.precoPromocional = parseFloat(requestData.salePrice);
        }
        
        const responseFlat = UrlFetchApp.fetch("https://api.bling.com.br/v3/produtos/lojas", {
          "method": "POST",
          "headers": {
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          "payload": JSON.stringify(payloadFlat),
          "muteHttpExceptions": true
        });
        
        const resCodeFlat = responseFlat.getResponseCode();
        if (resCodeFlat === 200 || resCodeFlat === 201) {
          resCode = resCodeFlat;
          resText = responseFlat.getContentText();
        }
      }
      
      if (resCode === 200 || resCode === 201) {
        return jsonResponse({ success: true });
      } else {
        let msg = resText;
        try {
          const parsed = JSON.parse(resText);
          if (parsed.error) {
            let details = parsed.error.description || parsed.error.message || '';
            if (parsed.error.fields && Array.isArray(parsed.error.fields)) {
              const fieldErrors = parsed.error.fields.map(f => {
                const name = f.field || f.element || f.campo || 'campo';
                const msgText = f.msg || f.message || f.mensagem || f.description || 'erro de validação';
                return `${name}: ${msgText}`;
              }).join(', ');
              details += ` [Detalhes: ${fieldErrors}]`;
            }
            msg = details;
          }
        } catch(_) {}
        return jsonResponse({ success: false, error: msg });
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
  
  let finalFormat = product.blingFormat || "S";
  if (product.stock) {
    const stockKeys = Object.keys(product.stock);
    const hasMultipleSizes = stockKeys.length > 1;
    const hasColorGrade = stockKeys.some(function(k) {
      return product.stock[k] && typeof product.stock[k] === 'object';
    });
    if (finalFormat === "S" && (hasMultipleSizes || hasColorGrade)) {
      finalFormat = "V";
    }
  }
  
  const payload = {
    "nome": product.name,
    "codigo": product.sku || String(product.id),
    "preco": parseFloat(product.price) || 0,
    "tipo": product.blingType || "P",
    "situacao": product.status === "Ativo" ? "A" : "I",
    "formato": finalFormat,
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
      var imageUrls = product.imgUrl.split(',').map(function(u) { return u.trim(); }).filter(function(u) { return u !== ''; });
      imageUrls.forEach(function(url) {
        var finalImgUrl = url;
        if (finalImgUrl.toLowerCase().indexOf('.webp') > -1) {
          finalImgUrl = finalImgUrl.replace(/\.webp/gi, '.jpg');
        }
        payload.midia.imagens.imagensURL.push({
          "link": finalImgUrl
        });
      });
    }
  }
  
  if (finalFormat === 'V' && product.stock) {
    payload.variacoes = [];
    var keys = Object.keys(product.stock);
    var varIdx = 1;
    
    // Buscar variações existentes no Bling para obter IDs e evitar erro de SKU duplicado no PUT
    var existingVariationsMap = {};
    if (product.blingId) {
      try {
        var getUrl = "https://api.bling.com.br/v3/produtos/" + product.blingId;
        var getResponse = UrlFetchApp.fetch(getUrl, {
          "method": "GET",
          "headers": {
            "Authorization": "Bearer " + token,
            "Accept": "application/json"
          },
          "muteHttpExceptions": true
        });
        if (getResponse.getResponseCode() === 200) {
          var getJson = JSON.parse(getResponse.getContentText());
          if (getJson.data && getJson.data.variacoes) {
            getJson.data.variacoes.forEach(function(v) {
              if (v.codigo) {
                existingVariationsMap[v.codigo.toUpperCase().trim()] = String(v.id);
              }
            });
          }
        }
      } catch(err) {
        Logger.log("Erro ao buscar variacoes existentes do produto no Bling: " + err.toString());
      }
    }
    
    // Check if any size has color stock
    var isColor = keys.some(function(k) {
      return product.stock[k] && typeof product.stock[k] === 'object';
    });
    
    if (isColor) {
      for (var sz in product.stock) {
        var val = product.stock[sz];
        var szUpper = sz.toUpperCase();
        
        if (val && typeof val === 'object') {
          for (var col in val) {
            var qty = parseInt(val[col]) || 0;
            var colUpper = col.toUpperCase();
            var colSkuPart = colUpper.replace(/\s+/g, '-');
            var varSku = (product.sku || String(product.id)) + "-" + colSkuPart + "-" + szUpper;
            var varSkuKey = varSku.toUpperCase().trim();
            
            var varObj = {
              "nome": product.name + " - " + colUpper + " - " + szUpper,
              "codigo": varSku,
              "preco": parseFloat(finalPrice) || 0,
              "tipo": "P",
              "formato": "S",
              "pesoBruto": parseFloat(product.weightGross) || 0,
              "pesoLiquido": parseFloat(product.weightNet) || 0,
              "dimensoes": {
                "largura": parseFloat(product.width) || 0,
                "altura": parseFloat(product.height) || 0,
                "profundidade": parseFloat(product.depth) || 0,
                "unidadeMedida": parseInt(product.blingUnitMeasure) || 2
              },
              "variacao": {
                "nome": "Cor:" + colUpper + ";Tamanho:" + szUpper,
                "opcao": colUpper + ";" + szUpper,
                "ordem": varIdx++
              },
              "estoque": qty
            };
            
            if (product.blingId) {
              varObj.variacao.produtoPai = {
                "id": parseInt(product.blingId)
              };
            }
            
            if (existingVariationsMap[varSkuKey]) {
              varObj.id = parseInt(existingVariationsMap[varSkuKey]);
            }
            
            payload.variacoes.push(varObj);
          }
        } else {
          var qty = parseInt(val) || 0;
          var varSku = (product.sku || String(product.id)) + "-PADRAO-" + szUpper;
          var varSkuKey = varSku.toUpperCase().trim();
          
          var varObj = {
            "nome": product.name + " - PADRAO - " + szUpper,
            "codigo": varSku,
            "preco": parseFloat(finalPrice) || 0,
            "tipo": "P",
            "formato": "S",
            "pesoBruto": parseFloat(product.weightGross) || 0,
            "pesoLiquido": parseFloat(product.weightNet) || 0,
            "dimensoes": {
              "largura": parseFloat(product.width) || 0,
              "altura": parseFloat(product.height) || 0,
              "profundidade": parseFloat(product.depth) || 0,
              "unidadeMedida": parseInt(product.blingUnitMeasure) || 2
            },
            "variacao": {
              "nome": "Cor:PADRAO;Tamanho:" + szUpper,
              "opcao": "PADRAO;" + szUpper,
              "ordem": varIdx++
            },
            "estoque": qty
          };
          
          if (product.blingId) {
            varObj.variacao.produtoPai = {
              "id": parseInt(product.blingId)
            };
          }
          
          if (existingVariationsMap[varSkuKey]) {
            varObj.id = parseInt(existingVariationsMap[varSkuKey]);
          }
          
          payload.variacoes.push(varObj);
        }
      }
    } else {
      for (var sz in product.stock) {
        var qty = parseInt(product.stock[sz]) || 0;
        var szUpper = sz.toUpperCase();
        var varSku = (product.sku || String(product.id)) + "-" + szUpper;
        var varSkuKey = varSku.toUpperCase().trim();
        
        var varObj = {
          "nome": product.name + " - " + szUpper,
          "codigo": varSku,
          "preco": parseFloat(finalPrice) || 0,
          "tipo": "P",
          "formato": "S",
          "pesoBruto": parseFloat(product.weightGross) || 0,
          "pesoLiquido": parseFloat(product.weightNet) || 0,
          "dimensoes": {
            "largura": parseFloat(product.width) || 0,
            "altura": parseFloat(product.height) || 0,
            "profundidade": parseFloat(product.depth) || 0,
            "unidadeMedida": parseInt(product.blingUnitMeasure) || 2
          },
          "variacao": {
            "nome": "Tamanho:" + szUpper,
            "opcao": szUpper,
            "ordem": varIdx++
          },
          "estoque": qty
        };
        
        if (product.blingId) {
          varObj.variacao.produtoPai = {
            "id": parseInt(product.blingId)
          };
        }
        
        if (existingVariationsMap[varSkuKey]) {
          varObj.id = parseInt(existingVariationsMap[varSkuKey]);
        }
        
        payload.variacoes.push(varObj);
      }
    }
  }

  let url = "https://api.bling.com.br/v3/produtos";
  let method = "POST";
  
  if (product.blingId) {
    url += "/" + product.blingId;
    method = "PUT";
    payload.actionEstoque = "Z"; // Evitar erros ao converter produto simples para variação no Bling
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
    
    let resText = response.getContentText();
    let responseCode = response.getResponseCode();
    
    if (responseCode === 404 && method === "PUT") {
      url = "https://api.bling.com.br/v3/produtos";
      method = "POST";
      const retryResponse = UrlFetchApp.fetch(url, {
        "method": method,
        "headers": {
          "Authorization": "Bearer " + token,
          "Accept": "1.0",
          "Content-Type": "application/json"
        },
        "payload": JSON.stringify(payload),
        "muteHttpExceptions": true
      });
      resText = retryResponse.getContentText();
      responseCode = retryResponse.getResponseCode();
    }
    
    if (responseCode === 200 || responseCode === 201 || responseCode === 204) {
      let blingId = method === "POST" ? "" : product.blingId;
      
      if (responseCode !== 204 && resText) {
        try {
          const data = JSON.parse(resText);
          if (data.data && data.data.id) {
            blingId = String(data.data.id);
          }
        } catch(e) {
          Logger.log("Erro ao parsear resposta POST Bling: " + e.toString());
        }
      }
      
      if (blingId) {
        // 1. Atualizar estoque físico total
        var totalStock = 0;
        if (product.stock) {
          for (var sz in product.stock) {
            var val = product.stock[sz];
            if (val && typeof val === 'object') {
              for (var col in val) {
                totalStock += (parseInt(val[col]) || 0);
              }
            } else {
              totalStock += (parseInt(val) || 0);
            }
          }
        }
        updateBlingStock(blingId, totalStock, token);
        
        // 2. Vincular com a Shopee (Desabilitado automático, feito via painel)
        // linkProductToStore(blingId, product, token);
      }
      
      return { success: true, data: { id: blingId } };
    } else {
      Logger.log("Erro ao pushProductToBling: " + resText);
      let errMsg = "Bling API Error (Code " + responseCode + "): " + resText;
      try {
        const parsed = JSON.parse(resText);
        if (parsed.error) {
          let details = parsed.error.description || parsed.error.message || '';
          if (parsed.error.fields && Array.isArray(parsed.error.fields)) {
            var formatBlingFields = function(fields) {
              if (!fields || !Array.isArray(fields)) return "";
              return fields.map(function(f) {
                var name = f.field || f.element || f.campo || 'campo';
                var msgText = f.msg || f.message || f.mensagem || f.description || 'erro';
                var text = name + ": " + msgText;
                if (f.fields && Array.isArray(f.fields)) {
                  text += " (" + formatBlingFields(f.fields) + ")";
                }
                return text;
              }).join(', ');
            };
            const fieldErrors = formatBlingFields(parsed.error.fields);
            details += " [Detalhes: " + fieldErrors + "]";
          }
          if (details) errMsg = details;
        }
      } catch(_) {}

      if (errMsg.indexOf("já foi cadastrado") > -1 || errMsg.indexOf("já cadastrado") > -1) {
        errMsg = "O SKU/Código deste produto já está em uso por outro cadastro no Bling.\n\n" +
                 "Para resolver, escolha uma das opções:\n" +
                 "1. Mude o SKU deste produto no painel para um código diferente e único.\n" +
                 "2. Se este produto for o mesmo que já está no Bling, copie o ID dele no Bling e cole no campo 'ID do Produto no Bling (Vínculo com Bling ERP)' antes de salvar.";
      }

      return { success: false, error: errMsg };
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

function generateProductDetailsWithAI(name, categoriesList, passedKey) {
  const apiKey = passedKey || PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    return { success: false, error: "Chave API do Gemini não configurada. Insira a sua chave nas Configurações do painel da Sophia Store." };
  }
  
  const prompt = "Você é um assistente especialista em e-commerce de moda feminina.\n" +
    "Com base no nome/título do produto abaixo, gere os dados cadastrais sugeridos em formato JSON estrito.\n" +
    "Título do produto: \"" + name + "\"\n" +
    "Categorias permitidas: " + JSON.stringify(categoriesList) + "\n\n" +
    "Instruções para o JSON:\n" +
    "- \"sku\": gere um SKU limpo e único em letras maiúsculas baseado no nome (ex: VEST-MIDI-PRETO-01).\n" +
    "- \"cat\": escolha exatamente uma das categorias permitidas. Se nenhuma se adequar, tente escolher a mais próxima ou \"Vestidos\" / \"Blusas\" / \"Calças\".\n" +
    "- \"brand\": use \"Sophia Elegance\" ou sugira uma se o nome contiver outra.\n" +
    "- \"desc\": gere uma descrição rica, elegante e persuasiva para e-commerce (2 parágrafos destacando caimento e conforto).\n" +
    "- \"blingDescShort\": resumo simples de 1 linha.\n" +
    "- \"weightNet\": peso líquido em kg (ex: 0.2 para blusas, 0.35 para vestidos, etc. Apenas número).\n" +
    "- \"weightGross\": peso bruto em kg (um pouco maior que o líquido, ex: 0.25 para blusas. Apenas número).\n" +
    "- \"width\": largura física da embalagem/produto dobrado em cm (Apenas número).\n" +
    "- \"height\": altura da embalagem em cm (Apenas número).\n" +
    "- \"depth\": profundidade da embalagem em cm (Apenas número).\n" +
    "- \"attrGender\": \"Feminino\".\n" +
    "- \"attrColor\": a cor principal identificada no nome (ex: \"Preto\", \"Azul\", \"Floral\", etc. Se não houver, deixe em branco).\n" +
    "- \"attrMaterial\": tecido sugerido com base no título ou tipo (ex: \"Crepe\", \"Linho\", \"Viscose\", \"Algodão\").\n" +
    "- \"attrAgeGroup\": \"Adulto\".\n\n" +
    "Retorne APENAS o JSON válido, sem markdown ou explicações.";

  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey;
  const payload = {
    "contents": [{
      "parts": [{
        "text": prompt
      }]
    }],
    "generationConfig": {
      "responseMimeType": "application/json"
    }
  };
  
  try {
    const response = UrlFetchApp.fetch(url, {
      "method": "POST",
      "contentType": "application/json",
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    });
    
    const resCode = response.getResponseCode();
    const resText = response.getContentText();
    
    if (resCode === 200) {
      const resJson = JSON.parse(resText);
      const content = resJson.candidates[0].content.parts[0].text;
      const parsedData = JSON.parse(content);
      return { success: true, data: parsedData };
    } else {
      return { success: false, error: "Erro na API do Gemini (Código " + resCode + "): " + resText };
    }
  } catch (e) {
    return { success: false, error: "Exception ao chamar Gemini: " + e.toString() };
  }
}

// Importa novos produtos do Bling ERP para o Supabase
function importBlingProductsToSupabase(existingBlingIds) {
  const token = getValidBlingToken();
  if (!token) return { success: false, error: "Token Bling inválido ou expirado." };
  
  // 1. Obter todos os produtos resumidos do Bling (limite de 5 páginas / 500 produtos)
  let page = 1;
  let hasMore = true;
  const summarizedMainProducts = [];
  const summarizedVariations = [];
  
  try {
    while (hasMore && page <= 5) {
      const url = "https://api.bling.com.br/v3/produtos?pagina=" + page + "&limite=100";
      const response = UrlFetchApp.fetch(url, {
        method: "GET",
        headers: {
          "Authorization": "Bearer " + token,
          "Accept": "application/json"
        },
        muteHttpExceptions: true
      });
      
      if (response.getResponseCode() !== 200) {
        break;
      }
      
      const json = JSON.parse(response.getContentText());
      if (json.data && json.data.length > 0) {
        json.data.forEach(p => {
          if (p.pai && p.pai.id) {
            summarizedVariations.push(p);
          } else {
            summarizedMainProducts.push(p);
          }
        });
        if (json.data.length < 100) {
          hasMore = false;
        } else {
          page++;
        }
      } else {
        hasMore = false;
      }
    }
  } catch(e) {
    return { success: false, error: "Erro ao buscar lista de produtos do Bling: " + e.toString() };
  }
  
  // 2. Filtrar produtos principais que não existem no Supabase
  const existingSet = {};
  if (existingBlingIds && Array.isArray(existingBlingIds)) {
    existingBlingIds.forEach(id => {
      existingSet[String(id)] = true;
    });
  }
  
  const missingSummary = summarizedMainProducts.filter(p => !existingSet[String(p.id)]);
  if (missingSummary.length === 0) {
    return { success: true, count: 0, message: "Todos os produtos do Bling já estão cadastrados." };
  }
  
  // Limitar a importação de no máximo 15 produtos por clique para evitar estouro de limite de tempo
  const limit = Math.min(missingSummary.length, 15);
  const importedProducts = [];
  
  // Obter a URL do Supabase para saber o próximo ID disponível
  const supabaseUrl = PropertiesService.getScriptProperties().getProperty('SUPABASE_URL') || "https://sfocvsknccuehrnoouox.supabase.co";
  const supabaseKey = PropertiesService.getScriptProperties().getProperty('SUPABASE_KEY') || "sb_publishable_GiCiYoNOMlpImpdQkKjVdg_8mZJhM1k";
  
  let nextId = 1;
  try {
    const supRes = UrlFetchApp.fetch(supabaseUrl + "/rest/v1/produtos?select=id&order=id.desc&limit=1", {
      method: "GET",
      headers: {
        "apikey": supabaseKey,
        "Authorization": "Bearer " + supabaseKey
      }
    });
    if (supRes.getResponseCode() === 200) {
      const data = JSON.parse(supRes.getContentText());
      if (data.length > 0) {
        nextId = parseInt(data[0].id) + 1;
      }
    }
  } catch(e) {
    Logger.log("Erro ao buscar último ID no Supabase: " + e.toString());
  }
  
  // 3. Buscar detalhes de cada produto faltante e salvar
  for (let i = 0; i < limit; i++) {
    const pSummary = missingSummary[i];
    try {
      const fullUrl = "https://api.bling.com.br/v3/produtos/" + pSummary.id;
      const fullRes = UrlFetchApp.fetch(fullUrl, {
        method: "GET",
        headers: {
          "Authorization": "Bearer " + token,
          "Accept": "application/json"
        },
        muteHttpExceptions: true
      });
      
      if (fullRes.getResponseCode() !== 200) continue;
      
      const fullJson = JSON.parse(fullRes.getContentText());
      if (!fullJson.data) continue;
      const p = fullJson.data;
      
      // Mapear imagens
      let imgUrl = "";
      if (p.midia && p.midia.imagens && p.midia.imagens.imagensURL) {
        imgUrl = p.midia.imagens.imagensURL.map(img => img.link).join(',');
      }
      
      // Buscar estoque das variações (se for produto pai)
      const varIds = [];
      if (p.variacoes && p.variacoes.length > 0) {
        p.variacoes.forEach(v => varIds.push(v.id));
      }
      
      const stockMap = {};
      if (varIds.length > 0) {
        const stockUrl = "https://api.bling.com.br/v3/estoques/saldos?idsProdutos[]=" + varIds.join("&idsProdutos[]=");
        const stockRes = UrlFetchApp.fetch(stockUrl, {
          method: "GET",
          headers: {
            "Authorization": "Bearer " + token,
            "Accept": "application/json"
          },
          muteHttpExceptions: true
        });
        if (stockRes.getResponseCode() === 200) {
          const stockJson = JSON.parse(stockRes.getContentText());
          if (stockJson.data) {
            stockJson.data.forEach(s => {
              stockMap[String(s.produto.id)] = parseInt(s.saldoFisico) || 0;
            });
          }
        }
      }
      
      // Construir objeto de estoque
      let stockObj = {};
      let hasSizes = false;
      
      if (p.variacoes && p.variacoes.length > 0) {
        p.variacoes.forEach(v => {
          const qty = stockMap[String(v.id)] || 0;
          if (v.variacao && v.variacao.opcao) {
            const option = v.variacao.opcao; // ex: "Preto;M" ou "M"
            const parts = option.split(';');
            
            if (parts.length === 2) {
              const color = parts[0].trim().toLowerCase();
              const size = parts[1].trim().toLowerCase();
              if (!stockObj[size]) stockObj[size] = {};
              stockObj[size][color] = qty;
              hasSizes = true;
            } else if (parts.length === 1) {
              const size = parts[0].trim().toLowerCase();
              stockObj[size] = qty;
              hasSizes = true;
            }
          }
        });
      }
      
      if (!hasSizes) {
        // Se for produto simples, busca o próprio saldo
        const singleStockUrl = "https://api.bling.com.br/v3/estoques/saldos?idsProdutos[]=" + p.id;
        const singleStockRes = UrlFetchApp.fetch(singleStockUrl, {
          method: "GET",
          headers: {
            "Authorization": "Bearer " + token,
            "Accept": "application/json"
          },
          muteHttpExceptions: true
        });
        let qty = 0;
        if (singleStockRes.getResponseCode() === 200) {
          const singleStockJson = JSON.parse(singleStockRes.getContentText());
          if (singleStockJson.data && singleStockJson.data.length > 0) {
            qty = parseInt(singleStockJson.data[0].saldoFisico) || 0;
          }
        }
        stockObj = { pp: 0, p: qty, m: 0, g: 0, gg: 0 };
      }
      
      // Montar payload final do produto
      const payload = {
        id: nextId++,
        name: p.nome,
        sku: p.codigo || "",
        cat: "Outros", // Categoria padrão (pode ser editada)
        cost: parseFloat(p.precoCusto) || 0,
        price: parseFloat(p.preco) || 0,
        sale_price: null,
        stock: stockObj,
        status: p.situacao === "A" ? "Ativo" : "Inativo",
        featured: false,
        img_url: imgUrl,
        cloud_id: "",
        bling_id: String(p.id),
        brand: p.marca || "",
        gtin: p.gtin || "",
        weight_net: parseFloat(p.pesoLiquido) || 0,
        weight_gross: parseFloat(p.pesoBruto) || 0,
        width: parseFloat(p.dimensoes ? p.dimensoes.largura : 0) || 0,
        height: parseFloat(p.dimensoes ? p.dimensoes.altura : 0) || 0,
        depth: parseFloat(p.dimensoes ? p.dimensoes.profundidade : 0) || 0,
        bling_format: p.formato || "S",
        bling_type: p.tipo || "P",
        bling_unit: p.unidade || "UN",
        bling_condition: parseInt(p.condicao) || 1,
        bling_production: p.tipoProducao || "P",
        bling_expiration: p.dataValidade || "",
        bling_free_shipping: !!p.freteGratis,
        bling_gtin_tributario: p.gtinTributario || "",
        bling_volumes: parseInt(p.volumes) || 1,
        bling_items_box: parseInt(p.itensPorCaixa) || 1,
        bling_unit_measure: parseInt(p.dimensoes ? p.dimensoes.unidadeMedida : 2) || 2,
        bling_category_id: p.categoria ? String(p.categoria.id) : "",
        bling_link_externo: p.linkExterno || "",
        bling_video_url: p.midia && p.midia.video ? p.midia.video.url : "",
        bling_desc_short: p.descricaoCurta || "",
        bling_desc_comp: p.descricaoComplementar || "",
        bling_observacoes: p.observacoes || "",
        bling_tags: p.tags ? p.tags.join(',') : ""
      };
      
      // Gravar no Supabase
      const writeRes = UrlFetchApp.fetch(supabaseUrl + "/rest/v1/produtos", {
        method: "POST",
        headers: {
          "apikey": supabaseKey,
          "Authorization": "Bearer " + supabaseKey,
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      
      if (writeRes.getResponseCode() === 201 || writeRes.getResponseCode() === 200) {
        importedProducts.push(payload);
      }
    } catch(e) {
      Logger.log("Erro ao importar produto " + pSummary.nome + ": " + e.toString());
    }
  }
  
  return {
    success: true,
    count: importedProducts.length,
    message: "Importados " + importedProducts.length + " produtos com sucesso do Bling.",
    data: importedProducts
  };
}
