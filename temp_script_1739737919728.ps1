
        $shell = New-Object -ComObject Shell.Application
        $folder = Split-Path "C:\Users\slowe\image-tagger\backend\uploads\1739737919726-kuro_poster_1.jpg"
        $filename = Split-Path "C:\Users\slowe\image-tagger\backend\uploads\1739737919726-kuro_poster_1.jpg" -Leaf
        $shellFolder = $shell.Namespace($folder)
        $shellFile = $shellFolder.ParseName($filename)
        
        # Get Tags property
        $tags = $shellFolder.GetDetailsOf($shellFile, 18)
        
        @{
          tags = $tags
        } | ConvertTo-Json
        tags = $tags
        } | ConvertTo-Json
      