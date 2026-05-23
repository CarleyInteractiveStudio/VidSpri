import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms, utils
from PIL import Image
import os

# --- GENERADOR (El Artista) ---
class TinyPixelGenerator(nn.Module):
    def __init__(self, latent_dim=100):
        super(TinyPixelGenerator, self).__init__()
        self.main = nn.Sequential(
            # Entrada: Vector latente de ruido [batch, 100, 1, 1]
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
            nn.Tanh() # Salida [-1, 1]
        )

    def forward(self, input):
        return self.main(input)

# --- DISCRIMINADOR (El Crítico) ---
class TinyPixelDiscriminator(nn.Module):
    def __init__(self):
        super(TinyPixelDiscriminator, self).__init__()
        self.main = nn.Sequential(
            # 32x32 -> 16x16
            nn.Conv2d(3, 64, 4, 2, 1, bias=False),
            nn.LeakyReLU(0.2, inplace=True),

            # 16x16 -> 8x8
            nn.Conv2d(64, 128, 4, 2, 1, bias=False),
            nn.BatchNorm2d(128),
            nn.LeakyReLU(0.2, inplace=True),

            # 8x8 -> 4x4
            nn.Conv2d(128, 256, 4, 2, 1, bias=False),
            nn.BatchNorm2d(256),
            nn.LeakyReLU(0.2, inplace=True),

            # 4x4 -> 1x1 (Salida: Probabilidad de que sea real)
            nn.Conv2d(256, 1, 4, 1, 0, bias=False),
            nn.Sigmoid()
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

# --- LOOP DE ENTRENAMIENTO GAN ---
def train():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Entrenando en: {device}")

    # Hiperparámetros
    batch_size = 64
    lr = 0.0002
    epochs = 100
    latent_dim = 100

    # Cargar datos
    if not os.path.exists("vidspri_dataset"):
        print("Error: No se encontró la carpeta 'vidspri_dataset'.")
        return

    dataset = SpriteDataset("vidspri_dataset", size=32)
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

    # Inicializar modelos
    netG = TinyPixelGenerator(latent_dim).to(device)
    netD = TinyPixelDiscriminator().to(device)

    # Pérdida y optimizadores
    criterion = nn.BCELoss()
    optimizerD = optim.Adam(netD.parameters(), lr=lr, betas=(0.5, 0.999))
    optimizerG = optim.Adam(netG.parameters(), lr=lr, betas=(0.5, 0.999))

    fixed_noise = torch.randn(64, latent_dim, 1, 1, device=device)

    print("🚀 Iniciando entrenamiento GAN...")
    for epoch in range(epochs):
        for i, real_images in enumerate(dataloader):
            curr_batch_size = real_images.size(0)
            real_images = real_images.to(device)

            # --- 1. ENTRENAR DISCRIMINADOR ---
            netD.zero_grad()
            # Datos reales
            label = torch.full((curr_batch_size,), 1.0, device=device)
            output = netD(real_images).view(-1)
            errD_real = criterion(output, label)
            errD_real.backward()

            # Datos falsos
            noise = torch.randn(curr_batch_size, latent_dim, 1, 1, device=device)
            fake_images = netG(noise)
            label.fill_(0.0)
            output = netD(fake_images.detach()).view(-1)
            errD_fake = criterion(output, label)
            errD_fake.backward()

            optimizerD.step()

            # --- 2. ENTRENAR GENERADOR ---
            netG.zero_grad()
            label.fill_(1.0) # Queremos que el discriminador piense que son reales
            output = netD(fake_images).view(-1)
            errG = criterion(output, label)
            errG.backward()

            optimizerG.step()

        # Progreso cada época
        print(f"[{epoch}/{epochs}] Loss_D: {errD_real+errD_fake:.4f} Loss_G: {errG:.4f}")

        # Guardar muestras y checkpoints periódicamente
        if epoch % 10 == 0:
            with torch.no_grad():
                fake = netG(fixed_noise).detach().cpu()
            utils.save_image(fake, f"muestra_epoch_{epoch}.png", normalize=True)
            torch.save(netG.state_dict(), f"generator_v1_{epoch}.pth")

    print("✅ Entrenamiento finalizado. El archivo 'generator_v1_final.pth' está listo.")
    torch.save(netG.state_dict(), "generator_v1_final.pth")

if __name__ == "__main__":
    train()
