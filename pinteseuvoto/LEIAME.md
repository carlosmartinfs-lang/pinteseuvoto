# Pinte Seu Voto — como colocar no ar

Você não precisa saber programar. São 7 etapas, todas pelo navegador. Reserve umas 2 horas.

Você vai usar 4 serviços:

| Serviço | Pra quê | Custo |
|---|---|---|
| GitHub | Guarda o código do site | Grátis |
| Supabase | Banco de dados (guarda os quadradinhos) | Grátis no começo |
| Mercado Pago | Gera o Pix e avisa quando foi pago | Tarifa por Pix recebido |
| Vercel | Deixa o site no ar + domínio | Grátis no começo; domínio pago |

---

## 1. Mercado Pago: pegar o Access Token

1. No app do Mercado Pago, cadastre uma **chave Pix** (Pix → Minhas chaves).
2. Entre em **mercadopago.com.br/developers** → **Suas integrações** → **Criar aplicação**.
3. Nome: `Pinte Seu Voto`. Tipo: **Pagamentos online** → **Checkout Transparente** (ou "API de pagamentos").
4. Abra **Credenciais de produção**, ative, e copie o **Access Token** (começa com `APP_USR-`).

> Nunca mostre esse token pra ninguém nem cole em chat.

## 2. Supabase: criar o banco

1. Crie conta em **supabase.com** → **New project**. Região: **South America (São Paulo)**. Anote a senha.
2. Quando o projeto terminar de criar, abra **SQL Editor** → **New query**.
3. Abra o arquivo `supabase/schema.sql` desta pasta, copie **tudo**, cole lá e clique **Run**. Tem que aparecer "Success".
4. Vá em **Project Settings → API** (ou **API Keys**) e anote 3 coisas:
   - **Project URL** (ex: `https://abcd.supabase.co`)
   - **anon / publishable key**
   - **service_role / secret key** (essa é secreta!)

## 3. GitHub: subir o código

1. Crie conta em **github.com** → botão **+** → **New repository**. Nome: `pinteseuvoto`. Marque **Private**. **Create repository**.
2. Na página do repositório, clique em **uploading an existing file**.
3. Descompacte o zip no seu computador, abra a pasta `pinteseuvoto`, selecione **tudo que está dentro dela** e arraste pra página. Espere subir e clique **Commit changes**.

## 4. Vercel: colocar no ar

1. Crie conta em **vercel.com** usando **Continue with GitHub**.
2. **Add New → Project** → escolha o repositório `pinteseuvoto` → **Import**.
3. Abra **Environment Variables** e adicione estas 5 (nome à esquerda, valor à direita):

| Nome | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL do Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role / secret key |
| `MP_ACCESS_TOKEN` | Access Token do Mercado Pago |
| `SITE_URL` | `https://pinteseuvotofxl.com` |

4. Clique **Deploy**. Em 1–2 minutos o site está no ar num endereço tipo `pinteseuvoto.vercel.app`.

## 5. Domínio: pinteseuvotofxl.com

1. No projeto da Vercel: **Settings → Domains**.
2. Digite `pinteseuvotofxl.com`. Se estiver livre, a própria Vercel oferece comprar (cartão de crédito, cobrança anual). Compre ali mesmo: ela já configura tudo sozinha.
3. Espere alguns minutos até aparecer "Valid Configuration".

> Letras maiúsculas não importam em domínio: `PinteseuvotoFxL.com` e `pinteseuvotofxl.com` são o mesmo endereço.

Se comprar o domínio em outro lugar (Cloudflare, Namecheap, GoDaddy), adicione-o na Vercel do mesmo jeito e siga as instruções de DNS que ela mostrar.

## 6. Webhook do Mercado Pago (o aviso de pagamento)

O site já pede o aviso automaticamente em cada Pix, mas configure também, por garantia:

1. **Suas integrações** → sua aplicação → **Webhooks** → **Configurar notificações**.
2. URL de produção: `https://pinteseuvotofxl.com/api/webhook`
3. Evento: **Pagamentos**. Salve.

## 7. Testar com dinheiro de verdade (R$ 1)

1. Abra o site, selecione **1 quadradinho**, preencha apelido, mensagem e e-mail.
2. Pague o Pix pelo app do **seu banco** (Inter ou Nubank).
3. Em alguns segundos deve aparecer "Pago!" e o quadradinho fica pintado, e você aparece no ranking.

Funcionou? Está no ar. 🎉

---

## Dia a dia

**Apagar uma mensagem ofensiva:** Supabase → **Table Editor** → `orders` → ache a linha → edite `message` ou `nickname`.

**Apagar quadradinhos de alguém:** Supabase → **Table Editor** → `orders` → apague a linha do pedido. Os quadradinhos dela somem junto. (Isso não devolve o dinheiro: o reembolso é feito no Mercado Pago.)

**Ver quanto vendeu:** Supabase → `orders`, filtre `status = paid`. Ou no próprio extrato do Mercado Pago.

**Aumentar o mural (ex: 10 milhões):** no GitHub, edite `lib/config.js` e troque `W` e `H` (ex: `W = 4000`, `H = 2500`). Ao salvar, a Vercel publica sozinha. Os quadradinhos já pintados continuam no lugar.

**Mudar preço, cores ou limite por compra:** também em `lib/config.js`.

**Adicionar palavrões ao filtro:** lista `BAD_WORDS` em `lib/config.js`.

## Se algo der errado

- **Site abre mas o mural não carrega:** confira as 3 variáveis do Supabase na Vercel e se o `schema.sql` rodou sem erro. Depois de mudar variável na Vercel, faça **Redeploy**.
- **"Não consegui gerar o Pix":** confira o `MP_ACCESS_TOKEN` (tem que ser o de **produção**) e se a conta tem chave Pix cadastrada.
- **Pagou e não pintou:** confira o webhook (etapa 6). O site também confere sozinho a cada 4 segundos enquanto a janela do Pix está aberta.
- **Ver erros:** Vercel → seu projeto → **Logs**.
