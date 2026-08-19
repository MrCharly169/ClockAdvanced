param(
    [string]$BaseUrl = "http://127.0.0.1:18124",
    [string]$Entity = "sensor.clock_advanced_lab_status",
    [string]$ConditionEntity = "sensor.schedule_helper_lab_status",
    [string]$VacationEntity = "input_boolean.vacation_mode",
    [string]$AllowEntity = "input_boolean.allow_alarm",
    [string]$BlockEntity = "input_boolean.quiet_mode",
    [string]$NumericEntity = "input_number.home_count"
)

$ErrorActionPreference = "Stop"
$ClientId = "$($BaseUrl.TrimEnd('/'))/"

$LoginFlow = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login_flow" `
    -ContentType "application/json" `
    -Body (@{
        client_id = $ClientId
        handler = @("trusted_networks", $null)
        redirect_uri = $ClientId
    } | ConvertTo-Json -Depth 5)

if ($LoginFlow.type -ne "create_entry") {
    throw "Trusted-network login is not ready. Complete local HA onboarding first."
}

$Token = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/token" `
    -ContentType "application/x-www-form-urlencoded" `
    -Body @{
        grant_type = "authorization_code"
        code = $LoginFlow.result
        client_id = $ClientId
    }
$Headers = @{ Authorization = "Bearer $($Token.access_token)" }

function Get-LabState {
    param([string]$EntityId)
    Invoke-RestMethod -Uri "$BaseUrl/api/states/$EntityId" -Headers $Headers
}

function Invoke-LabService {
    param(
        [string]$Domain,
        [string]$Service,
        [string]$EntityId
    )
    Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/services/$Domain/$Service" `
        -Headers $Headers -ContentType "application/json" `
        -Body (@{ entity_id = $EntityId } | ConvertTo-Json) | Out-Null
}

function Wait-LabState {
    param(
        [string]$EntityId,
        [string]$Expected,
        [int]$TimeoutSeconds = 5
    )
    $Deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $Deadline) {
        if ((Get-LabState $EntityId).state -eq $Expected) {
            return
        }
        Start-Sleep -Milliseconds 250
    }
    $Actual = (Get-LabState $EntityId).state
    throw "$EntityId expected '$Expected', got '$Actual'"
}

function Restore-LabBoolean {
    param(
        [string]$EntityId,
        [string]$OriginalState
    )
    $Domain = $EntityId.Split(".", 2)[0]
    $Service = if ($OriginalState -eq "on") { "turn_on" } else { "turn_off" }
    Invoke-LabService $Domain $Service $EntityId
}

function Set-LabNumber {
    param(
        [string]$EntityId,
        [double]$Value
    )
    Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/services/input_number/set_value" `
        -Headers $Headers -ContentType "application/json" `
        -Body (@{ entity_id = $EntityId; value = $Value } | ConvertTo-Json) | Out-Null
}

function Set-LabWeekdayAlarm {
    param(
        [string]$EntityId,
        [string]$Day,
        [string]$Time,
        [bool]$Enabled
    )
    Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/services/clock_advanced/set_weekday_alarm" `
        -Headers $Headers -ContentType "application/json" `
        -Body (@{ entity_id = $EntityId; day = $Day; time = $Time; enabled = $Enabled } | ConvertTo-Json) | Out-Null
}

function Wait-LabWeekdayAlarm {
    param([string]$EntityId, [string]$Day, [string]$Time, [int]$TimeoutSeconds = 5)
    $Deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $Deadline) {
        $Current = (Get-LabState $EntityId).attributes.schedule | Where-Object { $_.day -eq $Day }
        if ($Current.time.StartsWith($Time.Substring(0, 5))) { return }
        Start-Sleep -Milliseconds 250
    }
    throw "$EntityId weekday $Day did not reach $Time"
}

$ConfigResult = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/config/core/check_config" `
    -Headers $Headers -ContentType "application/json" -Body "{}"
if ($ConfigResult.result -ne "valid") {
    throw "Home Assistant configuration invalid: $($ConfigResult.errors)"
}

$Status = Get-LabState $Entity
$Attributes = $Status.attributes
if ($Attributes.card_contract -ne 1) {
    throw "Clock Advanced Card contract 1 is not available"
}
if ($Attributes.card_resource -ne "/clock_advanced/clock-advanced-card.js") {
    throw "Unexpected Clock Advanced Card resource"
}
if (-not $Attributes.guards.workday -or -not $Attributes.guards.confirmation) {
    throw "Clock Advanced guard metadata is missing from the Card contract"
}
if (-not $Attributes.settings.timeout_minutes) {
    throw "Clock Advanced safety metadata is missing from the Card contract"
}
if (-not $Attributes.card_yaml.Contains("mode: easy")) {
    throw "Clock Advanced easy Card YAML is missing from the entity contract"
}
if (-not $Attributes.badge_yaml.Contains("custom:clock-advanced-badge")) {
    throw "Clock Advanced Badge YAML is missing from the entity contract"
}

$Attributes.controls.PSObject.Properties | ForEach-Object {
    if (-not $_.Value) {
        throw "Missing entity for control $($_.Name)"
    }
    Get-LabState $_.Value | Out-Null
}

$CardSource = (Invoke-WebRequest -UseBasicParsing `
    -Uri "$BaseUrl/clock_advanced/clock-advanced-card.js").Content
if (-not $CardSource.Contains("customElements.define(CARD_TAG")) {
    throw "Bundled Card resource did not contain the custom element"
}
if (-not $CardSource.Contains("customElements.define(BADGE_TAG")) {
    throw "Bundled Card resource did not contain the custom badge"
}
if (-not $CardSource.Contains('class="clock-symbol" icon="mdi:alarm"') -or
    -not $CardSource.Contains('class="state-marker"')) {
    throw "Bundled Badge resource did not contain the stable alarm symbol and lifecycle marker"
}

$BrandResponse = Invoke-WebRequest -UseBasicParsing `
    -Uri "$BaseUrl/api/brands/integration/clock_advanced/icon.png?placeholder=no" `
    -Headers $Headers
if ($BrandResponse.StatusCode -ne 200 -or $BrandResponse.RawContentLength -lt 1000) {
    throw "Clock Advanced local brand icon is not available"
}

$VacationOriginal = (Get-LabState $VacationEntity).state
$AllowOriginal = (Get-LabState $AllowEntity).state
$BlockOriginal = (Get-LabState $BlockEntity).state
$NumericOriginal = [double](Get-LabState $NumericEntity).state
$EnabledEntity = $Attributes.controls.enabled
$EnabledOriginal = (Get-LabState $EnabledEntity).state
$NativeVacationEntity = $Attributes.controls.vacation_mode
$NativeVacationOriginal = (Get-LabState $NativeVacationEntity).state
$FirstScheduleDay = $Attributes.schedule | Select-Object -First 1
$OriginalWeekdayTime = $FirstScheduleDay.time
$OriginalWeekdayEnabled = [bool]$FirstScheduleDay.enabled
$TestWeekdayTime = if ($OriginalWeekdayTime.StartsWith("23:55")) { "23:50:00" } else {
    ([datetime]::ParseExact($OriginalWeekdayTime.Substring(0, 5), "HH:mm", $null).AddMinutes(5)).ToString("HH:mm:ss")
}

try {
    Invoke-LabService "switch" "turn_on" $NativeVacationEntity
    Wait-LabState $Entity "vacation"
    Invoke-LabService "switch" "turn_off" $NativeVacationEntity
    Wait-LabState $Entity "scheduled"

    Set-LabWeekdayAlarm $Entity $FirstScheduleDay.day $TestWeekdayTime $OriginalWeekdayEnabled
    Wait-LabWeekdayAlarm $Entity $FirstScheduleDay.day $TestWeekdayTime

    Invoke-LabService "input_boolean" "turn_on" $VacationEntity
    Wait-LabState $Entity "vacation"
    Invoke-LabService "input_boolean" "turn_off" $VacationEntity
    Wait-LabState $Entity "scheduled"

    Invoke-LabService "input_boolean" "turn_off" $AllowEntity
    Wait-LabState $ConditionEntity "blocked"
    Invoke-LabService "input_boolean" "turn_on" $AllowEntity
    Wait-LabState $ConditionEntity "scheduled"

    Invoke-LabService "input_boolean" "turn_on" $BlockEntity
    Wait-LabState $ConditionEntity "blocked"
    Invoke-LabService "input_boolean" "turn_off" $BlockEntity
    Wait-LabState $ConditionEntity "scheduled"

    Set-LabNumber $NumericEntity 1
    Wait-LabState $ConditionEntity "blocked"
    Set-LabNumber $NumericEntity 2
    Wait-LabState $ConditionEntity "scheduled"

    Invoke-LabService "switch" "turn_off" $EnabledEntity
    Wait-LabState $Entity "disabled"
    Invoke-LabService "switch" "turn_on" $EnabledEntity
    Wait-LabState $Entity "scheduled"
} finally {
    Restore-LabBoolean $VacationEntity $VacationOriginal
    Restore-LabBoolean $AllowEntity $AllowOriginal
    Restore-LabBoolean $BlockEntity $BlockOriginal
    Set-LabNumber $NumericEntity $NumericOriginal
    Restore-LabBoolean $EnabledEntity $EnabledOriginal
    Restore-LabBoolean $NativeVacationEntity $NativeVacationOriginal
    Set-LabWeekdayAlarm $Entity $FirstScheduleDay.day $OriginalWeekdayTime $OriginalWeekdayEnabled
}

Write-Output "Clock Advanced HA lab smoke test: PASS"
Write-Output "  HA configuration: $($ConfigResult.result)"
Write-Output "  Status entity: $Entity"
Write-Output "  Card contract: $($Attributes.card_contract)"
Write-Output "  Card, Badge, and local brand: PASS"
Write-Output "  Native Vacation, weekday editing, external Vacation, conditions, and enabled guards: PASS (original states restored)"
