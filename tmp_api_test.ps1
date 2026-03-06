$ErrorActionPreference = 'Stop'

function Invoke-Api {
  param(
    [string]$Method,
    [string]$Url,
    [hashtable]$Headers,
    [object]$Body,
    [hashtable]$Form
  )

  try {
    if ($Form) {
      $resp = Invoke-WebRequest -Method $Method -Uri $Url -Headers $Headers -Form $Form -UseBasicParsing
    } elseif ($null -ne $Body) {
      $json = $Body | ConvertTo-Json -Depth 10
      $h = @{'Content-Type'='application/json'}
      if ($Headers) { $Headers.Keys | ForEach-Object { $h[$_] = $Headers[$_] } }
      $resp = Invoke-WebRequest -Method $Method -Uri $Url -Headers $h -Body $json -UseBasicParsing
    } else {
      $resp = Invoke-WebRequest -Method $Method -Uri $Url -Headers $Headers -UseBasicParsing
    }

    $content = $null
    try { $content = $resp.Content | ConvertFrom-Json -Depth 20 } catch { $content = $resp.Content }

    return [PSCustomObject]@{ ok=$true; status=[int]$resp.StatusCode; body=$content }
  } catch {
    $status = 0
    $content = $_.Exception.Message
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
      try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $raw = $reader.ReadToEnd()
        try { $content = $raw | ConvertFrom-Json -Depth 20 } catch { $content = $raw }
      } catch {}
    }
    return [PSCustomObject]@{ ok=$false; status=$status; body=$content }
  }
}

$base = 'http://localhost:5000'
$results = New-Object System.Collections.ArrayList

function Add-Result($name, $res, $expect) {
  $pass = $res.status -eq $expect
  [void]$results.Add([PSCustomObject]@{ test = $name; expected = $expect; status = $res.status; pass = $pass })
}

$adminLogin = Invoke-Api -Method 'POST' -Url "$base/api/auth/login" -Body @{ email='admin.tc@autoecole.local'; password='Admin123!'; rememberMe=$false }
$eleveLogin = Invoke-Api -Method 'POST' -Url "$base/api/auth/login" -Body @{ email='eleve.tc@autoecole.local'; password='Eleve123!'; rememberMe=$false }
$instLogin  = Invoke-Api -Method 'POST' -Url "$base/api/auth/login" -Body @{ email='instructeur.tc@autoecole.local'; password='Instructeur123!'; rememberMe=$false }

Add-Result 'login_admin' $adminLogin 200
Add-Result 'login_eleve' $eleveLogin 200
Add-Result 'login_instructeur' $instLogin 200

$adminToken = $adminLogin.body.token
$eleveToken = $eleveLogin.body.token
$instToken = $instLogin.body.token

$hAdmin = @{ Authorization = "Bearer $adminToken" }
$hEleve = @{ Authorization = "Bearer $eleveToken" }
$hInst  = @{ Authorization = "Bearer $instToken" }

$meAdmin = Invoke-Api -Method 'GET' -Url "$base/api/users/me" -Headers $hAdmin
$meEleve = Invoke-Api -Method 'GET' -Url "$base/api/users/me" -Headers $hEleve
$meInst  = Invoke-Api -Method 'GET' -Url "$base/api/users/me" -Headers $hInst

Add-Result 'me_admin' $meAdmin 200
Add-Result 'me_eleve' $meEleve 200
Add-Result 'me_instructeur' $meInst 200

$dbAdmin = Invoke-Api -Method 'GET' -Url "$base/api/users/dashboard" -Headers $hAdmin
$dbEleve = Invoke-Api -Method 'GET' -Url "$base/api/users/dashboard" -Headers $hEleve
$dbInst  = Invoke-Api -Method 'GET' -Url "$base/api/users/dashboard" -Headers $hInst

Add-Result 'dashboard_admin_only_admin' $dbAdmin 200
Add-Result 'dashboard_denied_eleve' $dbEleve 403
Add-Result 'dashboard_denied_instructeur' $dbInst 403

$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$newStudentEmail = "eleve+$stamp@autoecole.local"
$newInstructorEmail = "instructeur+$stamp@autoecole.local"

$createStudent = Invoke-Api -Method 'POST' -Url "$base/api/users/students" -Headers $hAdmin -Body @{ email = $newStudentEmail; password = 'Eleve123!'; nom = 'Eleve CRUD'; telephone = '0601020304'; adresse = 'Paris'; dateNaissance = '2001-01-01'; statut = 'actif' }
Add-Result 'admin_create_student' $createStudent 201

$createInstructor = Invoke-Api -Method 'POST' -Url "$base/api/users/instructors" -Headers $hAdmin -Body @{ email = $newInstructorEmail; password = 'Instructeur123!'; nom = 'Instr CRUD'; telephone = '0601020305'; adresse = 'Lyon'; dateNaissance = '1990-02-02'; statut = 'actif' }
Add-Result 'admin_create_instructor' $createInstructor 201

$newStudentUid = $createStudent.body.user.uid
$newInstructorUid = $createInstructor.body.user.uid

$listStudents = Invoke-Api -Method 'GET' -Url "$base/api/users/students" -Headers $hAdmin
$listInstructors = Invoke-Api -Method 'GET' -Url "$base/api/users/instructors" -Headers $hAdmin
Add-Result 'admin_list_students' $listStudents 200
Add-Result 'admin_list_instructors' $listInstructors 200

$getStudent = Invoke-Api -Method 'GET' -Url "$base/api/users/students/$newStudentUid" -Headers $hAdmin
Add-Result 'admin_get_student_detail' $getStudent 200

$updateStudent = Invoke-Api -Method 'PUT' -Url "$base/api/users/students/$newStudentUid" -Headers $hAdmin -Body @{ telephone='0609090909'; adresse='Marseille' }
Add-Result 'admin_update_student' $updateStudent 200

$eleveTryStudents = Invoke-Api -Method 'GET' -Url "$base/api/users/students" -Headers $hEleve
Add-Result 'eleve_cannot_list_students' $eleveTryStudents 403

$getNewsEleve = Invoke-Api -Method 'GET' -Url "$base/api/news" -Headers $hEleve
Add-Result 'eleve_can_read_news' $getNewsEleve 200

$postNewsEleve = Invoke-Api -Method 'POST' -Url "$base/api/news" -Headers $hEleve -Form @{ title='News Eleve Forbidden'; content='No access'; category='actualites'; status='published' }
Add-Result 'eleve_cannot_create_news' $postNewsEleve 403

$postNewsAdmin = Invoke-Api -Method 'POST' -Url "$base/api/news" -Headers $hAdmin -Form @{ title="Actualite test $stamp"; content='Contenu test admin'; category='actualites'; status='published' }
Add-Result 'admin_create_news' $postNewsAdmin 201

$createSessionAdmin = Invoke-Api -Method 'POST' -Url "$base/api/sessions" -Headers $hAdmin -Body @{ studentId = $newStudentUid; instructorId = $newInstructorUid; courseType = 'conduite'; courseTitle = 'Session test admin'; scheduledDate = '2026-03-10T09:00:00.000Z'; scheduledTime = '09:00'; duration = 1; location = 'Centre Paris'; notes = 'Session API test' }
Add-Result 'admin_create_session' $createSessionAdmin 200

$createSessionEleve = Invoke-Api -Method 'POST' -Url "$base/api/sessions" -Headers $hEleve -Body @{ studentId = $newStudentUid; instructorId = $newInstructorUid; courseType = 'conduite'; courseTitle = 'Session denied'; scheduledDate = '2026-03-10T10:00:00.000Z'; scheduledTime = '10:00'; duration = 1 }
Add-Result 'eleve_cannot_create_session' $createSessionEleve 403

$getSessionsEleve = Invoke-Api -Method 'GET' -Url "$base/api/sessions" -Headers $hEleve
Add-Result 'eleve_can_read_sessions' $getSessionsEleve 200

$commentEleve = Invoke-Api -Method 'POST' -Url "$base/api/comments" -Headers $hEleve -Body @{ comment='Commentaire eleve de test' }
Add-Result 'eleve_comment' $commentEleve 200

$forgot = Invoke-Api -Method 'POST' -Url "$base/api/auth/forgot-password" -Body @{ email='eleve.tc@autoecole.local' }
Add-Result 'forgot_password' $forgot 200

$logoutEleve = Invoke-Api -Method 'POST' -Url "$base/api/auth/logout" -Headers $hEleve
Add-Result 'logout_eleve' $logoutEleve 200

$deleteStudent = Invoke-Api -Method 'DELETE' -Url "$base/api/users/students/$newStudentUid" -Headers $hAdmin
$deleteInstructor = Invoke-Api -Method 'DELETE' -Url "$base/api/users/instructors/$newInstructorUid" -Headers $hAdmin
Add-Result 'admin_delete_student' $deleteStudent 200
Add-Result 'admin_delete_instructor' $deleteInstructor 200

$passed = ($results | Where-Object { $_.pass -eq $true }).Count
$total = $results.Count

$out = [PSCustomObject]@{ summary = [PSCustomObject]@{ total=$total; passed=$passed; failed=($total-$passed)}; tests = $results }
$out | ConvertTo-Json -Depth 10 | Set-Content 'c:\Users\DELL\Desktop\Auto_Ecole\backend-auto_ecole\tmp_api_test_result.json'
Write-Output ($out | ConvertTo-Json -Depth 10)
