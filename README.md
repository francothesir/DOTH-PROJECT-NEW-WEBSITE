# DOTH PROJECT — NEW WEBSITE (V6)

Site estático com provador 3D em GLB e catálogo com renders reais.

## Publicação GitHub Pages

Em **Settings → Pages → Build and deployment**, selecione **GitHub Actions**.
O workflow `.github/workflows/pages.yml` instala dependências, baixa os 8 modelos públicos do Drive oficial, otimiza os GLBs, gera as miniaturas de catálogo e publica a pasta `public` no GitHub Pages. Todos os modelos são convertidos a partir das fontes originais e não dependem de URLs temporários.

Se o Drive limitar downloads, confira as permissões públicas da pasta e execute o workflow novamente em **Actions → Publish DOTH website → Run workflow**. O conteúdo de `sources/` é temporário no runner e não é commitado.

## Executar localmente (com assets já incluídos no ZIP de entrega)

```sh
python3 -m http.server 8000
```

Navegue até http://localhost:8000/ . Não abra o `index.html` diretamente como `file://`, pois os modelos GLB são carregados via `fetch()`.

## Correções V6

- Alternativa visual 2D quando o dispositivo bloqueia WebGL ou o GLB ainda está carregando.
- Compilação 3D via GitHub Pages com fontes públicas e otimizadas.
- Boné oncinha marrom e versão P&B voltados para a frente no catálogo e no visualizador; xadrez mantém direção frontal original.
- Ajuste de suporte a WebGL 2 e índices Uint32, quando disponível.

## Limites

O ajuste das peças 3D ao manequim ainda é aproximado, pois os GLBs não são peças rigadas para o corpo. Não há simulação física de tecido nem digitalização de todos os modos.
