$headers = @{'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
$outPath = "C:\movieswap\public\images"

Invoke-WebRequest -Uri "https://upload.wikimedia.org/wikipedia/en/8/81/ShawshankRedemptionMovie.jpg" -OutFile "$outPath\shawshank.jpg" -Headers $headers
Write-Host "shawshank"

Invoke-WebRequest -Uri "https://upload.wikimedia.org/wikipedia/en/1/1c/Godfather_poster.jpg" -OutFile "$outPath\godfather.jpg" -Headers $headers
Write-Host "godfather"

Invoke-WebRequest -Uri "https://upload.wikimedia.org/wikipedia/en/1/1a/The_Dark_Knight_%282008%29_poster.jpg" -OutFile "$outPath\darkknight.jpg" -Headers $headers
Write-Host "darkknight"

Invoke-WebRequest -Uri "https://upload.wikimedia.org/wikipedia/en/b/b5/12_Angry_Men_%281957%29.jpg" -OutFile "$outPath\12angry.jpg" -Headers $headers
Write-Host "12angry"

Invoke-WebRequest -Uri "https://upload.wikimedia.org/wikipedia/en/3/38/Schindler%27s_List_poster.jpg" -OutFile "$outPath\schindler.jpg" -Headers $headers
Write-Host "schindler"

Invoke-WebRequest -Uri "https://upload.wikimedia.org/wikipedia/en/3/3b/Pulp_Fiction_%281994%29_poster.jpg" -OutFile "$outPath\pulpfiction.jpg" -Headers $headers
Write-Host "pulpfiction"

Invoke-WebRequest -Uri "https://upload.wikimedia.org/wikipedia/en/2/2e/Inception_%282010%29_theatrical_poster.jpg" -OutFile "$outPath\inception.jpg" -Headers $headers
Write-Host "inception"

Invoke-WebRequest -Uri "https://upload.wikimedia.org/wikipedia/en/6/67/Forrest_Gump.png" -OutFile "$outPath\forrest.jpg" -Headers $headers
Write-Host "forrest"

Invoke-WebRequest -Uri "https://upload.wikimedia.org/wikipedia/en/c/c1/The_Matrix_Poster.jpg" -OutFile "$outPath\matrix.jpg" -Headers $headers
Write-Host "matrix"

Invoke-WebRequest -Uri "https://upload.wikimedia.org/wikipedia/en/b/bc/Interstellar_film_poster.jpg" -OutFile "$outPath\interstellar.jpg" -Headers $headers
Write-Host "interstellar"

Write-Host "Done"
