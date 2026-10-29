# Branding REHVA

Guia rápido da identidade visual atualmente implementada na loja. A direção combina moda feminina, rosa marcante, atitude, diversão e acabamento editorial. A referência Barbie aparece como inspiração de universo e energia pink; a REHVA mantém nome e identidade próprios, sem se apresentar como marca oficial ou afiliada à Barbie.

## Personalidade da marca

- **Expressiva e confiante:** a comunicação convida cada pessoa a criar o próprio estilo.
- **Feminina e divertida:** rosa, brilhos, estrelas e elementos lúdicos dão personalidade à experiência.
- **Fashion e editorial:** títulos serifados grandes, bastante espaço visual e fotografias de produto em destaque lembram um lookbook.
- **Digital e acessível:** a entrada animada, o cupom interativo, os filtros e a sacola aproximam a experiência de uma boutique online.

Mensagens que expressam o tom atual incluem “Toda a coleção, na palma da sua mão.”, “SEM REGRAS. SÓ VOCÊ.” e “A VIDA FICA MELHOR EM PINK”.

## Paleta principal

Os valores abaixo vêm dos estilos atuais da vitrine. Os nomes são descritivos e servem para orientar o uso; as variáveis CSS existentes continuam sendo a referência técnica.

| Cor | HEX | Variável CSS | Uso atual / recomendado |
| --- | --- | --- | --- |
| Pink REHVA | `#F20B83` | `--pink` | Cor de marca, wordmark, barra de anúncio, destaques e chamadas principais. |
| Pink quente | `#FA168D` | `--hot-pink` | Acento vibrante de interação e detalhes. |
| Pink profundo | `#BD075F` | `--deep-pink` | Botões, preços, links ativos e elementos que precisam de mais contraste. |
| Rosa claro | `#FFE9F2` | `--pale-pink` | Fundo de apoio e superfícies suaves. |
| Fundo da loja | `#FFFAFC` | — | Fundo claro principal da experiência de compra. |
| Tinta ameixa | `#321126` | `--ink` | Texto principal e contraste sobre fundos claros. |
| Malva acinzentado | `#806679` | — | Texto secundário, metadados e informações de apoio. |
| Branco | `#FFFFFF` | — | Texto sobre pink, botões de contraste e superfícies limpas. |

### Tons de apoio presentes na interface

| Cor | HEX / valor | Uso observado |
| --- | --- | --- |
| Rosa de fundo | `#FFF1F6` | Fundo do hero e áreas de transição suaves. |
| Rosa muito claro | `#FFF0F6` | Estados de foco, hover e superfícies de apoio. |
| Rosa blush | `#FFD3E5` | Luz radial decorativa no hero. |
| Rosa médio | `#E88AB5` | Detalhes e traços de apoio. |
| Rosa editorial | `#F781BD` → `#EC4D9C` → `#CB1C70` | Gradiente do cartão de cupom. |
| Roxo ameixa de abertura | `hsl(330 100% 20%)` (`#660033`) | Fundo de segurança da prévia e da animação de entrada. |
| Verde de sucesso | `#277044` | Confirmações no painel administrativo. |
| Vermelho de erro | `#AE1E4B` | Mensagens de erro no painel. |

O painel administrativo reutiliza os pinks, a tinta ameixa e tons claros, com pequenas diferenças de fundo e borda para separar a interface de gestão da vitrine.

## Observação sobre o título do hero

O título principal do hero atualmente usa um gradiente animado multicolorido em vez de ficar restrito à paleta rosa:

`#39FF14` → `#00FFFF` → `#FF073A` → `#FF6EC7` → `#FAFF00` → `#00F0FF`

Esse tratamento neon é uma escolha visual específica do título, não uma cor-base do branding. Para peças novas da marca, priorize os pinks REHVA, o ameixa e os fundos claros; use o gradiente multicolorido somente quando a intenção for reproduzir o efeito atual do hero.

## Tipografia

### Vitrine

- **Títulos editoriais:** Georgia, serif. É usada nos títulos do hero, da coleção e dos detalhes de produto, normalmente em tamanho grande e com espaçamento compacto.
- **Texto funcional:** Arial, sans-serif. Mantém boa leitura em navegação, descrições, botões e componentes da loja.
- **Hierarquia:** títulos serifados expressivos; rótulos, botões e pequenas chamadas em caixa alta, peso forte e espaçamento ampliado.

### Painel administrativo

- **Interface:** DM Sans, com Arial como alternativa.
- **Títulos:** Playfair Display, com Georgia como alternativa.
- As fontes DM Sans e Playfair Display são carregadas do Google Fonts; se não estiverem disponíveis, entram as alternativas locais declaradas no CSS.

## Elementos gráficos e direção de arte

- **Assinatura:** wordmark REHVA em pink, com a pequena estrela/asterisco como detalhe.
- **Símbolos:** estrelas e brilhos ajudam a comunicar energia e universo fashion; devem funcionar como acentos, não competir com as fotos.
- **Fotografia:** imagens de produto são o foco comercial; manter enquadramento consistente e deixar a peça dominar a composição.
- **Hero:** mistura de fundo rosa suave, chamada editorial e visual de celular, reforçando a ideia da coleção na palma da mão.
- **Cupom:** cartão pink em gradiente, com acabamento de ingresso e interação para copiar o código.
- **Movimento:** animações breves na entrada e em elementos de destaque. Respeitar a preferência do usuário por movimento reduzido.

## Aplicação responsiva

A identidade é a mesma em desktop e mobile. No mobile, preservar a hierarquia de títulos, o contraste pink sobre fundos claros, a leitura das informações e a visibilidade dos controles de compra. Reduzir espaçamentos e reorganizar blocos para a tela menor, sem trocar as cores centrais.

## Referência técnica

- Tokens principais da vitrine: `:root` em `src/styles/store.css`.
- Estilos da entrada: `src/styles/entry.css`.
- Tokens e aplicação visual do painel: `:root` em `src/styles/admin.css`.
- Textos editáveis da marca e do hero: configurações do catálogo no Firebase Realtime Database, com valores iniciais em `public/catalog.seed.json`.

Ao alterar a identidade, atualize este guia e os tokens CSS correspondentes para manter entrada, vitrine e painel consistentes.
