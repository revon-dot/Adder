# Adder Pages

Editor visual e estático para gerenciar JSONs compatíveis com Cubari, feito para rodar direto no GitHub Pages.

O Adder Pages não usa backend, FastAPI, banco de dados nem servidor próprio. Ele é um site feito com HTML, CSS e JavaScript puro. O carregamento, a criação, a edição e a exclusão dos arquivos acontecem diretamente no repositório configurado por meio da API do GitHub.

## Visão geral

O objetivo do Adder Pages é facilitar a manutenção de obras no formato Cubari sem precisar editar JSON manualmente.

Com ele, você conecta um repositório do GitHub, escolhe a pasta onde ficam os JSONs, edita as obras visualmente e salva tudo de volta no GitHub com commit automático.

## O que ele faz

- Conecta a um repositório do GitHub usando um Personal Access Token.
- Permite configurar owner, repositório, branch e pasta onde ficam os JSONs.
- Lista arquivos `.json` encontrados na pasta configurada.
- Mostra as obras em uma biblioteca/tabela com capa, título, nome do arquivo, quantidade de capítulos e ações.
- Permite buscar obras por título ou nome do arquivo.
- Cria novos JSONs compatíveis com Cubari.
- Edita os campos principais da obra:
  - `title`
  - `description`
  - `author`
  - `artist`
  - `cover`
  - `chapters`
- Gera automaticamente o nome do arquivo para obras novas a partir do título.
- Permite adicionar, editar e remover capítulos.
- Permite configurar número, título, volume, grupo, timestamp e URLs de imagens por capítulo.
- Permite colar várias URLs de imagens, uma por linha.
- Importa imagens de álbuns ImgChest usando a API oficial do ImgChest quando você informa um ImgChest API token.
- Tenta ler a página pública do ImgChest como fallback, quando possível.
- Salva o JSON no GitHub com commit automático.
- Permite deletar uma obra/JSON existente do repositório.
- Gera e copia a URL final do Cubari.
- Mostra aviso ao tentar sair do editor com alterações não salvas.
- Tem interface em português brasileiro e inglês americano.
- Salva configurações no navegador quando o usuário escolhe lembrar os dados.

## Fluxo do site

O app é organizado em quatro etapas principais.

### 1. Tela inicial

A primeira tela apresenta o Adder Pages e oferece os atalhos principais:

- começar uma nova conexão;
- carregar dados salvos neste navegador;
- abrir o guia rápido de funcionamento;
- trocar o idioma entre PT e EN.

### 2. Conexão com o GitHub

Na tela de conexão, você informa:

- GitHub username;
- Personal Access Token;
- owner do repositório;
- nome do repositório;
- branch;
- pasta onde ficam os JSONs;
- ImgChest API token opcional.

O próprio site mostra um guia para criar um Fine-grained Personal Access Token com a permissão mínima necessária.

### 3. Dashboard / Biblioteca

Depois de conectar, o dashboard carrega os JSONs encontrados na pasta configurada e mostra uma biblioteca com:

- capa;
- título da obra;
- nome do arquivo;
- quantidade de capítulos;
- botão de editar;
- botão de copiar link Cubari.

Também é possível criar uma nova obra, atualizar a listagem, buscar por título/arquivo ou trocar o repositório configurado.

### 4. Editor

No editor, você pode alterar os dados principais da obra e gerenciar capítulos.

O editor permite:

- editar título, descrição, artista, autor e capa;
- adicionar capítulo;
- editar capítulo existente;
- remover capítulo;
- importar imagens de um álbum ImgChest;
- salvar alterações no GitHub;
- abrir o arquivo salvo no GitHub;
- copiar o link Cubari;
- deletar a obra do repositório.

Se houver alterações não salvas e você tentar sair do editor, o app mostra um aviso antes de abandonar a tela.

## Estrutura atual dos arquivos

```txt
Adder/
├─ index.html
├─ styles.css
├─ editor-overrides.css
├─ logo-overrides.css
├─ favicon.svg
├─ app.js
├─ github.js
├─ repo.js
├─ cubari.js
├─ imgchest.js
├─ state.js
├─ ui.js
├─ utils.js
├─ i18n.js
├─ clipboard.js
├─ modals.js
├─ editor-collector.js
├─ editor-stats.js
├─ views/
│  ├─ landing.js
│  ├─ connect.js
│  ├─ connect-page.js
│  ├─ connect-events.js
│  ├─ dashboard.js
│  ├─ dashboard-page.js
│  ├─ dashboard-events.js
│  ├─ editor.js
│  ├─ editor-page.js
│  ├─ editor-events.js
│  ├─ editor-renderers.js
│  ├─ editor-save.js
│  └─ chapter-modal.js
├─ README.md
└─ .gitignore
```

A aplicação usa módulos JavaScript nativos. O arquivo `app.js` é o ponto de entrada e coordena a navegação entre landing page, conexão, dashboard e editor.

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub.
2. Coloque os arquivos do projeto na raiz do repositório.
3. Faça commit e push:

```bash
git init
git add .
git commit -m "Initial Adder Pages"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/NOME-DO-REPO.git
git push -u origin main
```

4. No GitHub, vá em:

```txt
Settings → Pages → Build and deployment
```

5. Escolha:

```txt
Source: Deploy from a branch
Branch: main
Folder: / root
```

6. Salve.

O site ficará disponível em um endereço parecido com:

```txt
https://SEU-USUARIO.github.io/NOME-DO-REPO/
```

## Como criar o token do GitHub

Use um **Fine-grained Personal Access Token** limitado ao repositório onde estão os JSONs.

Passo a passo:

1. Entre na sua conta do GitHub.
2. Vá em `Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token`.
3. Em `Token name`, use algo como `Adder Pages`.
4. Em `Expiration`, escolha uma validade, por exemplo `90 days`.
5. Em `Resource owner`, escolha o dono do repositório.
6. Em `Repository access`, escolha `Only select repositories` e selecione o repositório dos JSONs.
7. Em `Repository permissions`, marque:

```txt
Contents: Read and write
Metadata: Read-only
```

8. Clique em `Generate token`.
9. Copie o token e cole no campo `Personal Access Token` do Adder Pages.

O GitHub só mostra o token uma vez. Guarde em local seguro se precisar reutilizá-lo.

## Sobre o salvamento no GitHub

Quando você clica em **Salvar no GitHub**, o app monta o JSON atualizado e envia para o repositório usando a API do GitHub.

O commit gerado segue mensagens como:

```txt
Create nome-do-arquivo.json via Adder Pages
Update nome-do-arquivo.json via Adder Pages
Delete nome-do-arquivo.json via Adder Pages
```

Se você mudar o nome de um arquivo já existente, o app cria ou atualiza o novo arquivo, mas não apaga automaticamente o antigo. Essa decisão evita apagar arquivos por engano.

## URL final do Cubari

O app gera automaticamente o link final do Cubari a partir do caminho raw do GitHub.

Exemplo de caminho:

```txt
raw/revon-dot/OP/main/HxH.json
```

Esse caminho é convertido em uma URL Cubari no formato:

```txt
https://cubari.moe/read/gist/cmF3L3Jldm9uLWRvdC9PUC9tYWluL0h4SC5qc29u/
```

No dashboard, use **Copiar Cubari**.

Dentro do editor, a opção de copiar Cubari aparece depois que o arquivo já existe no GitHub.

## ImgChest

O Adder Pages pode importar imagens de álbuns ImgChest para preencher automaticamente a lista de URLs de um capítulo.

Como o site roda no GitHub Pages, ele não consegue executar Python, Playwright ou scripts locais. Por isso, a importação funciona assim:

1. Primeiro, tenta usar o endpoint oficial do ImgChest quando você informa um **ImgChest API token**.
2. Se não houver token, tenta ler a página pública do álbum diretamente pelo navegador.
3. Se o navegador bloquear a leitura por CORS, será necessário usar um ImgChest API token ou colar manualmente as URLs das imagens.

O ImgChest API token é diferente do GitHub Personal Access Token.

### Fluxo para adicionar capítulo com ImgChest

1. Abra uma obra no editor.
2. Clique em **Adicionar Capítulo**.
3. Preencha número, título, volume e grupo.
4. Cole a URL do álbum ImgChest.
5. Clique em **Importar ImgChest**.
6. Confira as URLs importadas.
7. Clique em **Criar Capítulo** ou **Salvar Capítulo**.
8. Clique em **Salvar no GitHub**.

## Formato esperado do JSON

Exemplo básico de JSON compatível:

```json
{
  "title": "Nome do Mangá",
  "description": "Descrição",
  "artist": "Artista",
  "author": "Autor",
  "cover": "https://exemplo.com/capa.jpg",
  "chapters": {
    "1": {
      "title": "Capítulo 1",
      "volume": "",
      "last_updated": "1710000000",
      "groups": {
        "": [
          "https://exemplo.com/001.jpg",
          "https://exemplo.com/002.jpg"
        ]
      }
    }
  }
}
```

### Campos principais

| Campo | Descrição |
|---|---|
| `title` | Nome da obra. |
| `description` | Descrição da obra. |
| `artist` | Nome do artista. |
| `author` | Nome do autor. |
| `cover` | URL da imagem de capa. |
| `chapters` | Objeto com os capítulos da obra. |

### Campos de capítulo

| Campo | Descrição |
|---|---|
| `title` | Título do capítulo. |
| `volume` | Volume do capítulo. Pode ficar vazio. |
| `last_updated` | Timestamp Unix em segundos. |
| `groups` | Grupos de leitura e suas respectivas URLs de imagens. |

O nome do grupo pode ficar vazio:

```json
"groups": {
  "": [
    "https://exemplo.com/001.jpg"
  ]
}
```

## Idiomas

A interface tem suporte a:

- português brasileiro;
- inglês americano.

A escolha de idioma é salva no navegador.

## Dados salvos no navegador

O Adder Pages pode salvar algumas informações localmente no navegador para facilitar o uso:

- owner do repositório;
- nome do repositório;
- branch;
- pasta dos JSONs;
- idioma escolhido;
- token do GitHub, se você marcar a opção para lembrar;
- token do ImgChest, se você marcar a opção para lembrar.

Use a opção de lembrar tokens apenas em computadores confiáveis.

## Observações importantes

- O Adder Pages não hospeda imagens.
- O app apenas salva URLs de imagens no JSON.
- O app não publica capítulos sozinho; ele edita o arquivo JSON usado pelo Cubari.
- O token do GitHub precisa ter permissão de leitura e escrita em conteúdo do repositório.
- Se o ImgChest falhar por CORS, use um ImgChest API token ou cole as URLs manualmente.
- Alterações só entram no repositório depois de clicar em **Salvar no GitHub**.

## Desenvolvimento local

Como o projeto usa módulos JavaScript nativos, é melhor rodar com um servidor local simples em vez de abrir o `index.html` diretamente pelo navegador.

Exemplo com Python:

```bash
python -m http.server 8000
```

Depois abra:

```txt
http://localhost:8000/
```

Também é possível usar qualquer servidor estático, como Live Server, `npx serve` ou equivalente.

## Licença

Defina aqui a licença do projeto, se necessário.
