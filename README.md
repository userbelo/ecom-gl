# REHVA

Loja virtual responsiva da REHVA, com identidade visual pink/editorial, experiência de entrada animada e catálogo de produtos administrável. A loja usa links de compra individuais da Yampi cadastrados no painel e checkout hospedado pela plataforma.

## Experiência da loja

- A entrada começa com um convite para o REHVA Club e uma prévia estática.
- Ao clicar em **Entrar**, é reproduzido um GIF de abertura específico para desktop ou mobile. Com a preferência do navegador por movimento reduzido, a animação é pulada.
- A vitrine apresenta conteúdo institucional, filtros de categorias e cards de produtos.
- Cada produto pode ter página de detalhes com galeria de imagens, variações, tamanhos brasileiros e tabela de medidas.
- Os preços podem incluir valor promocional, preço original riscado e percentual de desconto.
- A sacola permite adicionar itens, alterar quantidades e remover produtos. Seu estado é mantido durante a sessão do navegador.
- Na página do produto, a pessoa escolhe cor, tamanho e quantidade antes de comprar. Cada combinação usa o link de compra da Yampi cadastrado no painel.
- Os cards levam aos detalhes do produto para evitar abrir um checkout sem a variante escolhida. A barra de compra fixa em mobile usa a mesma cor, tamanho e quantidade selecionados.
- A sacola combina os tokens dos links cadastrados em uma única URL de checkout Yampi, com as respectivas quantidades. Exibe o progresso dos descontos por quantidade, uma estimativa de economia, frete grátis e um atalho para montar kits; a Yampi calcula e confirma os valores no checkout.
- A página exclusiva de kits reúne os produtos do catálogo, permite escolher cor/tamanho e monta um checkout único com as quantidades selecionadas.
- Na página de kits, a cliente escolhe 2 peças = 10%, 3 = 15% ou 4 ou mais = 20%. Os preços e a economia estimados são recalculados por peça; o checkout usa os links normais dos produtos e a Yampi aplica o desconto automático conforme a quantidade. O cupom de primeira compra não é enviado nem deve acumular com o desconto do kit.
- Na página de produto, a pessoa pode copiar o cupom configurável de 5% para a primeira compra. O cupom de 10% da próxima compra permanece bloqueado até haver integração que confirme um pedido concluído na Yampi.

## Painel administrativo

O painel está em `/admin.html` durante o desenvolvimento e permite:

- Criar, editar e remover produtos.
- Configurar preço normal, preço promocional, descrição e categoria.
- Adicionar variações e múltiplas imagens por variação, incluindo upload de imagens.
- Ativar tamanhos e editar a tabela de medidas de cada produto.
- Cadastrar os links Yampi normais para cada combinação de cor e tamanho. Os kits usam os mesmos links, enviando as quantidades ao checkout para que as regras de desconto automático configuradas na Yampi sejam aplicadas.
- Baixar um JSON com produtos do catálogo que tenham ao menos um link Yampi válido, incluindo variações, tamanhos, tokens e URLs. Produtos sem link válido são omitidos; sem integração com a API, o export não confirma publicação ou estoque na Yampi.
- Gerenciar o título e a apresentação da página de kits, ativá-la ou desativá-la, configurar banners diferentes para desktop e mobile e configurar os percentuais das três faixas de quantidade. Os banners recomendados são 1360 × 314 px para desktop e 750 × 380 px para mobile.
- Guardar um link HTTP/HTTPS do fornecedor como referência administrativa. Esse campo não é exibido na vitrine nem usado como checkout.
- Criar, renomear e remover categorias.
- Editar textos, imagem de capa, código do cupom de primeira compra e percentuais das ofertas de primeira compra e recompra. O código de recompra não é armazenado no catálogo público.

O painel **não possui autenticação** e foi limitado ao desenvolvimento local. O servidor de produção não publica a interface administrativa e bloqueia operações de gravação. Não exponha o modo de desenvolvimento à internet.

## Tecnologias e estrutura

- Node.js, TypeScript e módulos ES.
- Vite para servir o projeto em desenvolvimento e gerar o bundle de produção.
- HTML e CSS responsivos; a interface da loja e do painel é implementada em TypeScript nativo.
- React e `@paper-design/shaders-react` são usados para o efeito visual de fundo.
- API HTTP local em `src/server/server.ts`; validação do catálogo, uploads e persistência ficam em `src/server/admin-store.ts`.

Arquivos principais:

| Arquivo | Responsabilidade |
| --- | --- |
| `index.html` | Estrutura da entrada, da vitrine e da página exclusiva de kits (`#kits`). |
| `src/client/entry.ts`, `src/styles/entry.css` | Comportamento e apresentação da introdução e do fundo visual. |
| `src/client/app.ts` | Transição da animação de entrada para a loja e inicialização do catálogo. |
| `src/client/product-cards.ts` | Catálogo, detalhes de produto, sacola, página de kits e início do checkout. |
| `src/styles/store.css` | Estilos responsivos da vitrine e dos produtos. |
| `admin.html`, `src/client/admin.ts`, `src/styles/admin.css` | Interface e comportamento do painel administrativo. |
| `src/server/server.ts`, `src/server/admin-store.ts` | Servidor, catálogo e administração. |
| `public/catalog.seed.json` | Catálogo inicial usado antes da primeira gravação no Firebase. |
| `public/assets/catalog/` | Imagens estáticas dos produtos. |
| `public/assets/intro/` | Animações de abertura para desktop e mobile. |
| `public/assets/posters/` | Imagens de prévia da entrada. |

## Dados e persistência

O catálogo online é carregado e salvo no Firebase Realtime Database, no caminho `catalog`. Se esse caminho ainda não existir, a loja usa `public/catalog.seed.json` como catálogo inicial. As imagens dos produtos são URLs HTTPS públicas informadas no painel.

Para preparar os produtos, informe no painel os links normais da Yampi por cor/tamanho e configure na Yampi os descontos automáticos para 2 peças (10%), 3 peças (15%) e 4 ou mais (20%), sem acumular com outros descontos. O checkout envia os produtos e as quantidades; não é necessário criar links especiais nem adicionar um código de cupom à URL. O cupom de primeira compra não é enviado à página de kits; a Yampi aplica somente a oferta de quantidade. Os valores mostrados na página são estimativas baseadas nos preços cadastrados no catálogo; a Yampi calcula o valor final no checkout.

O arquivo `database.rules.json` define leitura pública para a vitrine e gravação somente para usuários autenticados. Publique essas regras no Realtime Database antes de colocar o admin online.

## Como executar

Requer uma versão recente do Node.js e npm.

```powershell
npm install
npm run dev
```

Abra o endereço informado pelo servidor — por padrão, `http://localhost:4173`. A porta pode ser definida pela variável de ambiente `PORT`. A administração local fica em `http://localhost:4173/admin.html`.

Para gerar e servir a versão de produção:

```powershell
npm run build
npm start
```

O servidor de produção também usa a porta `4173` por padrão. Configure `PORT` se essa porta já estiver ocupada.

## Privacidade e integrações

- Os links Yampi são públicos e cadastrados por combinação de produto; a sacola envia ao checkout hospedado os tokens e as quantidades dos itens.
- O link do fornecedor existe para controle administrativo e não faz parte da experiência pública.
- A interface atual oferece convite para o grupo do WhatsApp; não há, neste fluxo descrito, formulário ou persistência própria de leads de nome e telefone.
- A sacola utiliza armazenamento de sessão do navegador e não substitui um sistema de pedidos ou pagamento.
