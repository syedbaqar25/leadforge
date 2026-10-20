import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UploadedFile,
  UseInterceptors,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { KnowledgeService } from './knowledge.service';
import { DirectTextDocumentDto, SearchKnowledgeDto, AskKnowledgeDto } from './dto';
import {
  CurrentOrgId,
  CurrentUserId,
  RequirePermissions,
} from '../../common/decorators/tenant.decorator';

@ApiTags('Knowledge Base & RAG')
@ApiBearerAuth()
@Controller('knowledge')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post('documents/text')
  @RequirePermissions('ai:documents:upload')
  @ApiOperation({ summary: 'Ingest text or markdown document into knowledge base' })
  @ApiResponse({ status: 201, description: 'Document ingested and chunks embedded successfully' })
  async createDocumentFromText(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string | null,
    @Body() dto: DirectTextDocumentDto,
  ) {
    return this.knowledgeService.createDocumentFromText(orgId, userId, dto);
  }

  @Post('documents/upload')
  @RequirePermissions('ai:documents:upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload file (PDF, TXT, MD, CSV, JSON) to knowledge base' })
  @ApiResponse({ status: 201, description: 'File validated, stored, chunked, and embedded' })
  async uploadDocument(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string | null,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided in form-data');
    }
    return this.knowledgeService.uploadDocument(orgId, userId, file);
  }

  @Get('documents')
  @RequirePermissions('ai:assistant')
  @ApiOperation({ summary: 'List all knowledge base documents for organization' })
  @ApiResponse({ status: 200, description: 'List of documents with chunk counts' })
  async getDocuments(@CurrentOrgId() orgId: string) {
    return this.knowledgeService.getDocuments(orgId);
  }

  @Get('documents/:id')
  @RequirePermissions('ai:assistant')
  @ApiOperation({ summary: 'Get document details and chunk breakdown' })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @ApiResponse({ status: 200, description: 'Document details with all chunks' })
  async getDocumentById(@CurrentOrgId() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.knowledgeService.getDocumentById(orgId, id);
  }

  @Delete('documents/:id')
  @RequirePermissions('ai:documents:upload')
  @ApiOperation({ summary: 'Delete document and all associated embeddings' })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @ApiResponse({ status: 200, description: 'Document deleted successfully' })
  async deleteDocument(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string | null,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.knowledgeService.deleteDocument(orgId, userId, id);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('ai:assistant')
  @ApiOperation({ summary: 'Perform semantic vector similarity search against knowledge chunks' })
  @ApiResponse({ status: 200, description: 'Ranked list of relevant knowledge chunks' })
  async searchChunks(@CurrentOrgId() orgId: string, @Body() dto: SearchKnowledgeDto) {
    return this.knowledgeService.searchChunks(orgId, dto);
  }

  @Post('ask')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('ai:assistant')
  @ApiOperation({ summary: 'Ask a question grounded strictly in knowledge base citations' })
  @ApiResponse({ status: 200, description: 'Grounded AI response citing verified sources' })
  async askQuestion(
    @CurrentOrgId() orgId: string,
    @CurrentUserId() userId: string | null,
    @Body() dto: AskKnowledgeDto,
  ) {
    return this.knowledgeService.askQuestion(orgId, userId, dto);
  }
}
