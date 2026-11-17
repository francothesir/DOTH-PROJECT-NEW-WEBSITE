"""Baixa do Drive os GLBs públicos da coleção DOTH para compilação da versão web."""
from pathlib import Path
import gdown
ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'sources'
SRC.mkdir(exist_ok=True,parents=True)
SOURCES={'manequim de tecido 3d modelo-2.glb': '10qDZ69b3K0SmVOYZ6UX_2wRXGZPgD8Jd', 'cream overalls 3d model.glb': '10GZhmycbp81mKGz9tJBG8yDE5fOl7g0-', 'cream short sleeve jacket 3d model.glb': '1pcWrBuQXFczjHVWFYVtYAqXjZGlzAD2X', 'cargo pants 3d model.glb': '1_1hRhHCEAH_HnowslgL-xZ7NCotFWcYt', 'black cargo pants 3d model.glb': '1hjus0rpIgnQJWdu6F_uYb6GiYgW6vBW4', 'camouflage cap 3d model.glb': '1FVVeIhM5CzJT0nd1c-KRvqysFd28d0XQ', 'plaid cap 3d model.glb': '1YksNmIYKd4BjpkJ9zcodrkjMFPP4sYIC', 'leopard print cap 3d model-2.glb': '1gu57iRK4PzqgkrNQ2Wqnv5Kf6nmXG_hL'}
for name,file_id in SOURCES.items():
    path=SRC/name
    if path.exists() and path.stat().st_size>10000: continue
    print(f'Download DOTH: {name}',flush=True)
    result=gdown.download(id=file_id,output=str(path),quiet=False)
    if not result or not path.exists() or path.stat().st_size<1000000: raise RuntimeError(f'Modelo inacessível: {name} ({file_id})')
    with path.open('rb') as f:
        if f.read(4)!=b'glTF':raise RuntimeError(f'Arquivo inválido: {name}')
