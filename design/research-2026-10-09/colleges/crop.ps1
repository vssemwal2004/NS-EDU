param([string]$Source, [int]$Y, [int]$Height = 1100, [string]$Out)
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($Source)
$h = [Math]::Min($Height, $img.Height - $Y)
$rect = New-Object System.Drawing.Rectangle 0, $Y, $img.Width, $h
$bmp = New-Object System.Drawing.Bitmap $img.Width, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($img, (New-Object System.Drawing.Rectangle 0, 0, $img.Width, $h), $rect, [System.Drawing.GraphicsUnit]::Pixel)
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose(); $img.Dispose()
