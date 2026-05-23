import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms
from PIL import Image
import os

# --- MODELO LIGERO (TINY-PIXEL-DIFFUSION) ---
class TinyPixelGenerator(nn.Module):
    """
    Un modelo ultra-ligero diseñado para generar pixel art de 32x32.
    """
    def __init__(self, latent_dim=100):
        super(TinyPixelGenerator, self).__init__()
        self.main = nn.Sequential(
            # Entrada: Vector latente de ruido
            nn.ConvTranspose2d(latent_dim, 256, 4, 1, 0, bias=False),
            nn.BatchNorm2d(256),
            nn.ReLU(True),

            # 4x4 -> 8x8
            nn.ConvTranspose2d(256, 128, 4, 2, 1, bias=False),
            nn.BatchNorm2d(128),
            nn.ReLU(True),

            # 8x8 -> 16x16
            nn.ConvTranspose2d(128, 64, 4, 2, 1, bias=False),
            nn.BatchNorm2d(64),
            nn.ReLU(True),

            # 16x16 -> 32x32
            nn.ConvTranspose2d(64, 3, 4, 2, 1, bias=False),
            nn.Tanh() # Salida normalizada [-1, 1]
        )

    def forward(self, input):
        return self.main(input)

# --- DATASET LOADER ---
class SpriteDataset(Dataset):
    def __init__(self, folder, size=32):
        self.folder = folder
        self.size = size
        self.files = [f for f in os.listdir(folder) if f.endswith('.png')]
        self.transform = transforms.Compose([
            transforms.Resize((size, size), interpolation=Image.NEAREST),
            transforms.ToTensor(),
            transforms.Normalize((0.5, 0.5, 0.5), (0.5, 0.5, 0.5))
        ])

    def __len__(self):
        return len(self.files)

    def __getitem__(self, idx):
        img_path = os.path.join(self.folder, self.files[idx])
        image = Image.open(img_path).convert('RGB')
        return self.transform(image)

# --- LOOP DE ENTRENAMIENTO BÁSICO ---
def train():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Entrenando en: {device}")

    # Hiperparámetros
    batch_size = 64
    lr = 0.0002
    epochs = 50
    latent_dim = 100

    # Cargar datos
    if not os.path.exists("vidspri_dataset"):
        print("Error: No se encontró la carpeta 'vidspri_dataset'. Ejecuta descargar_dataset.py primero.")
        return

    dataset = SpriteDataset("vidspri_dataset", size=32)
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

    # Inicializar modelo
    netG = TinyPixelGenerator(latent_dim).to(device)
    optimizer = optim.Adam(netG.parameters(), lr=lr, betas=(0.5, 0.999))

    print("Iniciando entrenamiento...")
    for epoch in range(epochs):
        for i, data in enumerate(dataloader):
            # Aquí iría la lógica de entrenamiento (GAN o Diffusion)
            # Por ahora es una estructura base para mostrar el proceso
            pass

        if epoch % 10 == 0:
            print(f"Epoch [{epoch}/{epochs}] completada.")
            # Guardar checkpoint
            torch.save(netG.state_dict(), f"checkpoint_pixel_{epoch}.pth")

    print("Entrenamiento finalizado.")

if __name__ == "__main__":
    # train() # Descomentar para ejecutar
    print("Script de entrenamiento cargado. Configurado para 32x32 pixel art.")
