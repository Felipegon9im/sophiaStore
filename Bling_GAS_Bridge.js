/**
 * SOPHIA ELEGANCE STORE - PONTE DE PAGAMENTO BLING
 * 
 * Instruções:
 * 1. Copie todo o código abaixo.
 * 2. Abra o seu projeto do Google Apps Script (onde você já configurou a sua planilha).
 * 3. Se você já tem a função doPost(e), adicione apenas o conteúdo de dentro do "if".
 *    Se não tiver, cole este arquivo inteiro no final do seu script.
 * 4. Salve e clique em "Implantar" -> "Nova Implantação" -> "App da Web" (Qualquer pessoa).
 */

const BLING_ACCESS_TOKEN = "COLE_AQUI_O_SEU_TOKEN_REAL_DO_BLING";

function doPost(e) {
  try {
    // Analisando os dados enviados pela vitrine
    const requestData = JSON.parse(e.postData.contents);
    
    // Rota de geração de Link de Pagamento
    if (requestData.action === 'checkoutBling') {
      
      const cartItems = requestData.cart;
      const totalAmount = requestData.total;

      // ==========================================
      // INTEGRAÇÃO REAL API V3 DO BLING ERP
      // ==========================================
      /*
      // O código abaixo exemplifica como chamar a API do Bling para criar uma cobrança/venda
      const options = {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'Authorization': 'Bearer ' + BLING_ACCESS_TOKEN
        },
        payload: JSON.stringify({
          data: {
            valor: totalAmount,
            historico: "Compra Site Sophia Elegance",
            // Demais parâmetros obrigatórios de acordo com sua Bling Conta
          }
        }),
        muteHttpExceptions: true
      };
      
      const response = UrlFetchApp.fetch("https://www.bling.com.br/Api/v3/contas/receber", options);
      const result = JSON.parse(response.getContentText());
      
      if (result.error) {
        throw new Error(result.error.message || "Erro na API do Bling");
      }
      
      const paymentLink = result.data.linkPagamento;
      */
      
      // ==========================================
      // SIMULAÇÃO TEMPORÁRIA (Remova quando preencher a API acima)
      // ==========================================
      const uniqueId = Math.floor(Math.random() * 1000000);
      const paymentLink = "https://pagamento.bling.com.br/pay/sophia/cart_" + uniqueId;
      
      // Retorna sucesso para o site com o link
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        link: paymentLink
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Se a rota não for encontrada
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: "Ação não reconhecida pelo script."
    })).setMimeType(ContentService.MimeType.JSON);

  } catch(error) {
    // Trata erros e devolve pro site alertar o cliente
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
